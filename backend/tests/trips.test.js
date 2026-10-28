import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Trip } from '../src/models/Trip.js';
import { CheckIn } from '../src/models/CheckIn.js';

describe('Trip Planning, Journey Monitoring & Check-Ins', () => {
  let authToken = null;
  let userId = null;

  beforeAll(async () => {
    process.env.USE_MEMORY_DB = 'true';
    await connectDb();
    await User.deleteMany({});
    await Trip.deleteMany({});
    await CheckIn.deleteMany({});

    const user = await User.create({
      name: 'Trip Tester',
      email: 'tripper@safepath.test',
      passwordHash: await User.hashPassword('Pass12345!'),
      preferences: { checkInGracePeriodMinutes: 5 }
    });
    userId = user._id;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tripper@safepath.test', password: 'Pass12345!' });

    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await disconnectDb();
  });

  let createdTripId = null;
  let firstCheckInId = null;

  it('plans a new trip with route coordinates and ETA', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Walk to Transit Station',
        startLocation: {
          address: 'Office',
          latitude: 40.7128,
          longitude: -74.0060
        },
        destination: {
          address: 'Metro Station',
          latitude: 40.7180,
          longitude: -74.0020
        },
        travelMode: 'walking',
        checkInIntervalMinutes: 10,
        expectedArrivalAt: new Date(Date.now() + 30 * 60000).toISOString()
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.trip.status).toBe('planned');
    expect(res.body.trip.routeCoordinates.length).toBeGreaterThan(0);
    createdTripId = res.body.trip._id;
  });

  it('starts the journey and schedules the first safety check-in', async () => {
    const res = await request(app)
      .post(`/api/v1/trips/${createdTripId}/start`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trip.status).toBe('active');
    expect(res.body.nextCheckIn).toBeDefined();
    expect(res.body.nextCheckIn.status).toBe('pending');
    firstCheckInId = res.body.nextCheckIn._id;
  });

  it('records live location ping during active journey', async () => {
    const res = await request(app)
      .post(`/api/v1/trips/${createdTripId}/location`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        latitude: 40.7150,
        longitude: -74.0040,
        accuracy: 5
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.currentLocation.latitude).toBe(40.7150);
  });

  it('acknowledges a safety check-in and schedules next check-in', async () => {
    const res = await request(app)
      .post(`/api/v1/check-ins/${firstCheckInId}/acknowledge`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        latitude: 40.7160,
        longitude: -74.0035,
        note: 'Halfway there, feeling safe.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.checkIn.status).toBe('completed');
    expect(res.body.nextCheckIn).toBeDefined();
  });

  it('completes the journey safely upon destination arrival', async () => {
    const res = await request(app)
      .post(`/api/v1/trips/${createdTripId}/complete`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trip.status).toBe('completed');
  });
});
