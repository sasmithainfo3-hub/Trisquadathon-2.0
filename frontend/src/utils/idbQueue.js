const DB_NAME = 'safepath_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'event_queue';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB not supported in this browser.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOfflineEvent(type, payload) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const eventRecord = {
      type, // 'CHECKIN' | 'LOCATION_PING' | 'MANUAL_EMERGENCY'
      payload,
      idempotencyKey: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      const addRequest = store.add(eventRecord);
      addRequest.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('safepath:queue-updated'));
        resolve(eventRecord);
      };
      addRequest.onerror = () => reject(addRequest.error);
    });
  } catch (err) {
    console.error('[SafePath IDB] Failed to enqueue offline event:', err);
    throw err;
  }
}

export async function getPendingEventsCount() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('status');

    return new Promise((resolve) => {
      const countReq = index.count('pending');
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => resolve(0);
    });
  } catch (err) {
    return 0;
  }
}

export async function getAllPendingEvents() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('status');

    return new Promise((resolve, reject) => {
      const req = index.getAll('pending');
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return [];
  }
}

export async function flushOfflineQueue(api) {
  const pendingEvents = await getAllPendingEvents();
  if (pendingEvents.length === 0) return { synced: 0, failed: 0 };

  console.log(`[SafePath IDB] Synchronizing ${pendingEvents.length} queued offline event(s)...`);
  const db = await openDatabase();
  let synced = 0;
  let failed = 0;

  for (const event of pendingEvents) {
    try {
      if (event.type === 'CHECKIN') {
        await api.post(`/check-ins/${event.payload.checkInId}/acknowledge`, {
          latitude: event.payload.latitude,
          longitude: event.payload.longitude,
          note: event.payload.note ? `${event.payload.note} (Synced from offline queue)` : '(Synced from offline queue)'
        });
      } else if (event.type === 'LOCATION_PING') {
        await api.post(`/trips/${event.payload.tripId}/location`, {
          latitude: event.payload.latitude,
          longitude: event.payload.longitude,
          accuracy: event.payload.accuracy
        });
      } else if (event.type === 'MANUAL_EMERGENCY') {
        await api.post('/alerts/manual', {
          tripId: event.payload.tripId,
          latitude: event.payload.latitude,
          longitude: event.payload.longitude,
          explanation: `${event.payload.explanation || 'Emergency'} (Queued offline at ${new Date(event.timestamp).toLocaleTimeString()})`,
          idempotencyKey: event.idempotencyKey,
          bypassGrace: true
        });
      }

      // Mark event as synced in IDB
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      event.status = 'synced';
      event.syncedAt = new Date().toISOString();
      store.put(event);
      synced++;
    } catch (err) {
      console.warn(`[SafePath IDB] Failed to sync event ${event.id}:`, err.message);
      failed++;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      event.retryCount = (event.retryCount || 0) + 1;
      store.put(event);
    }
  }

  window.dispatchEvent(new CustomEvent('safepath:queue-updated'));
  return { synced, failed };
}
