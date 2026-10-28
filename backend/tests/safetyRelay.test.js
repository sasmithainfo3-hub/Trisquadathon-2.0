import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { TrustedContact } from '../src/models/TrustedContact.js';
import { Alert } from '../src/models/Alert.js';
import { escalateAlert } from '../src/services/safetyRelay.js';

describe('Safety Relay Engine & Alert Lifecycle', () => {
  let authToken = null;
  let user = null;
  let contact1 = null;
  let contact2 = null;

  beforeAll(async () => {
    process.env.USE_MEMORY_DB = 'true';
    await connectDb();
    await User.deleteMany({});
    await TrustedContact.deleteMany({});
    await Alert.deleteMany({});

    user = await User.create({
      name: 'Relay Tester',
      email: 'relay@safepath.test',
      passwordHash: await User.hashPassword('Pass12345!'),
      preferences: {
        checkInGracePeriodMinutes: 5,
        defaultEscalationTimeoutMinutes: 10,
        emergencyGracePeriodSeconds: 0 // bypass grace for instant dispatch in tests
      }
    });

    contact1 = await TrustedContact.create({
      userId: user._id,
      name: 'Primary Contact',
      email: 'primary@contact.test',
      phone: '+15551112222',
      priorityOrder: 1,
      status: 'verified',
      canReceiveAlerts: true
    });

    contact2 = await TrustedContact.create({
      userId: user._id,
      name: 'Secondary Contact',
      email: 'secondary@contact.test',
      phone: '+15553334444',
      priorityOrder: 2,
      status: 'verified',
      canReceiveAlerts: true
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'relay@safepath.test', password: 'Pass12345!' });

    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('triggers manual emergency alert with idempotency and dispatches to Priority 1', async () => {
    const idempotencyKey = 'test-idemp-key-1001';

    const res1 = await request(app)
      .post('/api/v1/alerts/manual')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        latitude: 37.7749,
        longitude: -122.4194,
        explanation: 'Test emergency alert',
        idempotencyKey,
        bypassGrace: true
      });

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.alert.status).toBe('NOTIFIED');
    expect(res1.body.alert.activeContactIndex).toBe(0);
    expect(String(res1.body.alert.currentContactId?._id || res1.body.alert.currentContactId)).toBe(String(contact1._id));
    expect(res1.body.alert.publicAccessToken).toBeDefined();

    // Idempotency: second request with same key returns the exact same alert
    const res2 = await request(app)
      .post('/api/v1/alerts/manual')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        latitude: 37.7749,
        longitude: -122.4194,
        explanation: 'Test emergency alert retry',
        idempotencyKey,
        bypassGrace: true
      });

    expect(res2.status).toBe(201);
    expect(String(res2.body.alert._id)).toBe(String(res1.body.alert._id));
  });

  it('escalates alert to Priority 2 when Priority 1 does not acknowledge', async () => {
    const alert = await Alert.findOne({ userId: user._id, status: 'NOTIFIED' });
    expect(alert).toBeDefined();

    // Simulate timeout expiration trigger
    await escalateAlert(alert);

    const escalatedAlert = await Alert.findById(alert._id);
    expect(escalatedAlert.activeContactIndex).toBe(1);
    expect(escalatedAlert.escalationLevel).toBe(2);
    expect(String(escalatedAlert.currentContactId)).toBe(String(contact2._id));
  });

  it('allows contact to acknowledge alert via tokenized link, stopping escalation', async () => {
    const alert = await Alert.findOne({ userId: user._id, status: 'NOTIFIED' });
    expect(alert).toBeDefined();

    const ackRes = await request(app)
      .post(`/api/v1/alerts/token/${alert.publicAccessToken}/acknowledge`)
      .send({
        contactName: 'Secondary Contact',
        responseNote: 'I called her phone and am heading over now.'
      });

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.success).toBe(true);
    expect(ackRes.body.alert.status).toBe('ACKNOWLEDGED');
    expect(ackRes.body.alert.escalationTimeoutExpiresAt).toBeNull();
    expect(ackRes.body.alert.acknowledgedContactName).toBe('Secondary Contact');
  });

  it('allows user to resolve the emergency safely', async () => {
    const alert = await Alert.findOne({ userId: user._id });

    const resolveRes = await request(app)
      .post(`/api/v1/alerts/${alert._id}/resolve`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        resolutionNotes: 'Home safe with family.'
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.success).toBe(true);
    expect(resolveRes.body.alert.status).toBe('RESOLVED');
  });
});
