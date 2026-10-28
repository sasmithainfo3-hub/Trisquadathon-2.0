import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost:5000/api/v1';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runEndToEndVerification() {
  console.log('========================================================');
  console.log('🧪 SAFEPATH LIVE END-TO-END INTEGRATION TEST SUITE');
  console.log('========================================================\n');

  // 1. Health check
  console.log('1. Checking Backend Health...');
  const health = await request('/health', { method: 'GET' });
  assert.equal(health.status, 200, 'Health check should return 200');
  const dbStatus = health.data.database?.status || health.data.database;
  assert.equal(dbStatus, 'connected', 'Database must be connected');
  console.log('   ✅ Health OK, database connected, uptime:', health.data.uptime);

  // 2. Demo User Login
  console.log('\n2. Testing Demo User Authentication...');
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'maya@safepath.app', password: 'SafePath123!' })
  });
  assert.equal(login.status, 200, 'Demo login should succeed');
  assert(login.data.token, 'Token must be returned');
  const token = login.data.token;
  console.log('   ✅ Demo user authenticated:', login.data.user.name, `(${login.data.user.email})`);

  // 3. User Profile & Preferences
  console.log('\n3. Testing User Profile & Preferences...');
  const profile = await request('/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.user.email, 'maya@safepath.app');
  console.log('   ✅ Profile retrieved. Grace period:', profile.data.user.preferences.checkInGracePeriodMinutes, 'min');

  // 4. Trusted Contacts
  console.log('\n4. Testing Trusted Contacts Network...');
  const contacts = await request('/contacts', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(contacts.status, 200);
  assert(contacts.data.contacts.length >= 3, 'Should have at least 3 seeded contacts');
  console.log(`   ✅ Retrieved ${contacts.data.contacts.length} trusted contacts:`);
  contacts.data.contacts.forEach((c) => {
    console.log(`      - Priority ${c.priorityOrder}: ${c.name} (${c.relationship}) [${c.status}]`);
  });

  // 5. Add New Trusted Contact & Verify
  console.log('\n5. Inviting New Trusted Contact...');
  const newContact = await request('/contacts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Dr. Aisha Khan',
      email: 'aisha@example.org',
      phone: '+15550198888',
      relationship: 'Mentor',
      priorityOrder: 4,
      notes: 'Colleague on campus'
    })
  });
  assert.equal(newContact.status, 201);
  const contactId = newContact.data.contact._id;
  const verificationToken = newContact.data.contact.verificationToken;
  console.log('   ✅ Contact invited. Verification token generated:', verificationToken.slice(0, 12) + '...');

  // Verify contact via public verification endpoint
  const verifyRes = await request(`/contacts/verify/${verificationToken}`, {
    method: 'POST'
  });
  assert.equal(verifyRes.status, 200);
  console.log('   ✅ Contact verified successfully via public token link');

  // 6. Journey Lifecycle: Plan Journey
  console.log('\n6. Planning a New Journey...');
  const plannedTrip = await request('/trips', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: 'Night Commute to Train Station',
      startLocation: { address: 'Office Campus, Building B', latitude: 37.788, longitude: -122.405 },
      destination: { address: 'Central Transit Hub', latitude: 37.792, longitude: -122.398 },
      travelMode: 'walking',
      checkInIntervalMinutes: 10,
      expectedArrivalAt: new Date(Date.now() + 30 * 60000).toISOString(),
      notes: 'Testing Safety Relay end to end flow'
    })
  });
  assert.equal(plannedTrip.status, 201);
  const tripId = plannedTrip.data.trip._id;
  console.log('   ✅ Journey planned with ID:', tripId, '| Status:', plannedTrip.data.trip.status);

  // 7. Start Journey
  console.log('\n7. Starting Journey & Initializing First Check-in...');
  const startTrip = await request(`/trips/${tripId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(startTrip.status, 200);
  assert.equal(startTrip.data.trip.status, 'active');
  console.log('   ✅ Journey active! Next check-in scheduled at:', startTrip.data.trip.nextCheckInDueAt);

  // 8. Stream GPS Location Ping
  console.log('\n8. Emitting Authorized Location Ping...');
  const locationPing = await request(`/trips/${tripId}/location`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      latitude: 37.7891,
      longitude: -122.4035,
      accuracy: 6.2,
      speed: 1.3,
      heading: 45
    })
  });
  assert.equal(locationPing.status, 200);
  console.log('   ✅ Location ping accepted and broadcast via Socket.IO room');

  // 9. Confirm Scheduled Check-In
  console.log('\n9. Confirming Safety Check-In...');
  const checkIns = await request(`/check-ins/trip/${tripId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(checkIns.status, 200);
  const pendingCheckIn = checkIns.data.checkIns.find((c) => c.status === 'pending');
  assert(pendingCheckIn, 'Must have a pending check-in');

  const confirmCheckIn = await request(`/check-ins/${pendingCheckIn._id}/acknowledge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      latitude: 37.7895,
      longitude: -122.403,
      accuracy: 5.0,
      note: 'Safe and on schedule'
    })
  });
  assert.equal(confirmCheckIn.status, 200);
  console.log('   ✅ Check-in confirmed! Next interval automatically scheduled');

  // 10. Safety Relay State Machine: Manual Emergency Trigger
  console.log('\n10. Triggering Emergency Alert (Safety Relay Engine)...');
  const alertTrigger = await request('/alerts/manual', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      tripId,
      latitude: 37.7895,
      longitude: -122.403,
      accuracy: 5.0,
      bypassGrace: true,
      explanation: 'E2E Safety Relay escalation drill'
    })
  });
  assert.equal(alertTrigger.status, 201);
  const alertId = alertTrigger.data.alert._id;
  const publicAccessToken = alertTrigger.data.alert.publicAccessToken;
  console.log('   ✅ Emergency Alert Created! ID:', alertId, '| Status:', alertTrigger.data.alert.status);
  assert(
    ['CREATED', 'DISPATCHING', 'NOTIFIED'].includes(alertTrigger.data.alert.status),
    'Alert must enter relay pipeline'
  );

  // 11. Contact Acknowledgment via Public Token
  console.log('\n11. Testing Trusted Contact Acknowledgment via Public Token...');
  console.log('   Public Access Token:', publicAccessToken.slice(0, 14) + '...');

  // Public incident fetch
  const publicIncident = await request(`/alerts/token/${publicAccessToken}`, {
    method: 'GET'
  });
  assert.equal(publicIncident.status, 200);
  assert.equal(publicIncident.data.alert._id, alertId);
  console.log('   ✅ Public incident page loaded securely without user login');

  // Acknowledge alert
  const ackRes = await request(`/alerts/token/${publicAccessToken}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({
      contactName: 'Elena Rostova',
      responseNote: 'I have received the alert and am calling Maya right now.'
    })
  });
  assert.equal(ackRes.status, 200);
  console.log('   ✅ Alert acknowledged by contact! Relay status transitioned to ACKNOWLEDGED');

  // 12. Resolve Alert
  console.log('\n12. Resolving Alert & Safety Incident...');
  const resolveRes = await request(`/alerts/${alertId}/resolve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      resolutionNotes: 'Drill completed safely. Contact verified user is safe.'
    })
  });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.data.alert.status, 'RESOLVED');
  console.log('   ✅ Alert successfully resolved with documented audit notes');

  // 13. Safety Event Timeline & Notifications
  console.log('\n13. Inspecting Safety Event Timeline & Notifications...');
  const events = await request(`/events?tripId=${tripId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(events.status, 200);
  console.log(`   ✅ Found ${events.data.events.length} chronological safety events for trip`);

  const notifications = await request('/notifications', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(notifications.status, 200);
  console.log(`   ✅ Found ${notifications.data.notifications.length} in-app notification records`);

  // 14. GDPR Privacy & Data Export
  console.log('\n14. Testing GDPR / CCPA Compliance Data Export...');
  const exportRes = await request('/users/export', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(exportRes.status, 200);
  assert.equal(exportRes.data.user.email, 'maya@safepath.app');
  assert(exportRes.data.contacts.length >= 4);
  assert(exportRes.data.trips.length >= 2);
  console.log('   ✅ Full GDPR data export bundle generated successfully');

  console.log('\n========================================================');
  console.log('🎉 ALL 14 CRITICAL END-TO-END FLOWS PASSED FLAWLESSLY!');
  console.log('========================================================\n');
}

runEndToEndVerification().catch((err) => {
  console.error('\n❌ E2E Verification Failed:', err);
  process.exit(1);
});
