import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Send, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { api } from '../utils/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationCenterPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState('checking');
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState(null);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    if ('Notification' in window) {
      setPushStatus(Notification.permission);
    } else {
      setPushStatus('unsupported');
    }
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      // ignore
    }
  };

  const handleEnablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission);

      if (permission !== 'granted') {
        alert('Push notification permission was denied.');
        return;
      }

      const vapidRes = await api.get('/push/vapid-key');
      if (!vapidRes.success || !vapidRes.publicKey) {
        alert('Server VAPID public key is not configured.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidRes.publicKey)
      });

      const subData = subscription.toJSON();
      await api.post('/push/subscribe', {
        endpoint: subData.endpoint,
        keys: subData.keys
      });

      setPushMessage('Browser push notifications enabled successfully!');
      setTimeout(() => setPushMessage(null), 4000);
    } catch (err) {
      alert(`Push subscription error: ${err.message}`);
    }
  };

  const handleSendTestPush = async () => {
    setTestPushLoading(true);
    try {
      const res = await api.post('/push/test');
      if (res.success) {
        setPushMessage('Test push notification dispatched!');
      }
    } catch (err) {
      alert(err.message || 'Failed to dispatch test push');
    } finally {
      setTestPushLoading(false);
      setTimeout(() => setPushMessage(null), 4000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Notification Center</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Stay informed with real-time alerts, check-in reminders, and contact updates.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 self-start sm:self-auto"
          >
            <CheckCheck className="w-4 h-4 text-emerald-400" /> Mark All as Read
          </button>
        )}
      </div>

      {/* Web Push Configuration Card */}
      <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Browser Push Notifications</h4>
            <p className="text-xs text-slate-400">
              Permission Status: <strong className="text-indigo-300 capitalize">{pushStatus}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {pushStatus !== 'granted' ? (
            <button
              onClick={handleEnablePush}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs"
            >
              Enable Push Notifications
            </button>
          ) : (
            <button
              onClick={handleSendTestPush}
              disabled={testPushLoading}
              className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {testPushLoading ? 'Sending...' : 'Send Test Push'}
            </button>
          )}
        </div>
      </div>

      {pushMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
          {pushMessage}
        </div>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl text-xs text-slate-400">
          No notifications yet. You're completely up to date.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n._id}
              onClick={() => !n.isRead && handleMarkAsRead(n._id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                n.isRead
                  ? 'bg-slate-900/40 border-slate-800/60 text-slate-400'
                  : 'bg-indigo-950/30 border-indigo-500/40 text-slate-200 shadow-md shadow-indigo-950/30'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{n.title}</h4>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  )}
                </div>
                <p className="text-xs text-slate-300">{n.body}</p>
                <p className="text-[10px] text-slate-500">
                  {new Date(n.createdAt).toLocaleDateString()} at {new Date(n.createdAt).toLocaleTimeString()}
                </p>
              </div>

              {!n.isRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead(n._id);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold shrink-0"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
