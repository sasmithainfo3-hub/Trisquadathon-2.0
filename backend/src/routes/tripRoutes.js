import express from 'express';
import { z } from 'zod';
import { Trip } from '../models/Trip.js';
import { CheckIn } from '../models/CheckIn.js';
import { SafetyEvent } from '../models/SafetyEvent.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { calculateRoute } from '../services/routeService.js';
import { emitToTrip, emitToUser } from '../config/socket.js';
import { recordAuditLog } from '../services/auditService.js';

const router = express.Router();

const locationSchema = z.object({
  address: z.string().optional().default(''),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

const createTripSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  startLocation: locationSchema,
  destination: locationSchema,
  travelMode: z.enum(['walking', 'transit', 'driving', 'rideshare', 'cycling']).default('walking'),
  checkInIntervalMinutes: z.number().int().min(5).max(180).default(20),
  expectedArrivalAt: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Valid expected arrival time required' }),
  notes: z.string().max(500).optional().default('')
});

const locationPingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional().nullable(),
  speed: z.number().optional().nullable(),
  heading: z.number().optional().nullable()
});

// GET /api/v1/trips
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const query = { userId: req.user._id };
    if (status) query.status = status;

    const trips = await Trip.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Trip.countDocuments(query);

    res.json({
      success: true,
      trips,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/trips
router.post('/', requireAuth, validate(createTripSchema), async (req, res, next) => {
  try {
    const { title, startLocation, destination, travelMode, checkInIntervalMinutes, expectedArrivalAt, notes } = req.body;

    // Calculate route geometry and distance/duration
    const route = await calculateRoute({
      start: startLocation,
      destination,
      travelMode
    });

    const trip = await Trip.create({
      userId: req.user._id,
      title,
      startLocation,
      destination,
      routeCoordinates: route.coordinates,
      travelMode,
      checkInIntervalMinutes,
      expectedArrivalAt: new Date(expectedArrivalAt),
      notes,
      status: 'planned'
    });

    await SafetyEvent.create({
      tripId: trip._id,
      userId: req.user._id,
      eventType: 'TRIP_PLANNED',
      severity: 'info',
      title: 'Journey Planned',
      details: `Planned journey from ${startLocation.address || 'Start'} to ${destination.address}. Route length: ${(route.distanceMeters / 1000).toFixed(1)} km.`,
      triggeredBy: 'USER',
      triggeredById: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Journey planned successfully',
      trip
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/trips/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.user._id }).populate('currentAlertId');
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    // Get current pending check-in
    const nextCheckIn = await CheckIn.findOne({
      tripId: trip._id,
      status: { $in: ['pending', 'grace_period'] }
    }).sort({ scheduledAt: 1 });

    res.json({
      success: true,
      trip,
      nextCheckIn
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/trips/:id/start
router.post('/:id/start', requireAuth, async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.user._id });
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    if (trip.status === 'active') {
      return res.status(400).json({ success: false, message: 'Trip is already active' });
    }

    const now = new Date();
    trip.status = 'active';
    trip.startedAt = now;

    // Schedule first check-in
    const intervalMinutes = trip.checkInIntervalMinutes;
    const dueAt = new Date(now.getTime() + intervalMinutes * 60000);
    const graceMinutes = req.user.preferences?.checkInGracePeriodMinutes || 5;
    const graceExpiresAt = new Date(dueAt.getTime() + graceMinutes * 60000);

    trip.nextCheckInDueAt = dueAt;
    await trip.save();

    const checkIn = await CheckIn.create({
      tripId: trip._id,
      userId: req.user._id,
      scheduledAt: dueAt,
      dueAt,
      graceExpiresAt,
      status: 'pending'
    });

    await SafetyEvent.create({
      tripId: trip._id,
      userId: req.user._id,
      eventType: 'TRIP_STARTED',
      severity: 'info',
      title: 'Journey Started',
      details: `Active monitoring started. First check-in due at ${dueAt.toLocaleTimeString()}.`,
      triggeredBy: 'USER',
      triggeredById: req.user._id
    });

    emitToTrip(trip._id, 'trip:started', { trip, nextCheckIn: checkIn });
    emitToUser(req.user._id, 'trip:started', { trip, nextCheckIn: checkIn });

    res.json({
      success: true,
      message: 'Journey started. Safe monitoring is active.',
      trip,
      nextCheckIn: checkIn
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/trips/:id/location
router.post('/:id/location', requireAuth, validate(locationPingSchema), async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.user._id });
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    const locationPoint = {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      accuracy: req.body.accuracy || null,
      speed: req.body.speed || null,
      heading: req.body.heading || null,
      timestamp: new Date()
    };

    trip.currentLocation = locationPoint;

    // Keep locationHistory bounded for privacy (last 100 points maximum)
    if (!trip.locationHistory) trip.locationHistory = [];
    trip.locationHistory.push(locationPoint);
    if (trip.locationHistory.length > 100) {
      trip.locationHistory.shift();
    }

    await trip.save();

    emitToTrip(trip._id, 'trip:location_updated', {
      tripId: trip._id,
      currentLocation: locationPoint
    });

    res.json({
      success: true,
      currentLocation: locationPoint
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/trips/:id/complete
router.post('/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.user._id });
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    trip.status = 'completed';
    trip.completedAt = new Date();
    trip.nextCheckInDueAt = null;
    await trip.save();

    // Mark any pending check-ins as completed
    await CheckIn.updateMany(
      { tripId: trip._id, status: { $in: ['pending', 'grace_period'] } },
      { $set: { status: 'completed', acknowledgedAt: new Date() } }
    );

    await SafetyEvent.create({
      tripId: trip._id,
      userId: req.user._id,
      eventType: 'TRIP_COMPLETED',
      severity: 'info',
      title: 'Arrived Safely',
      details: 'User confirmed safe arrival at destination. Journey monitoring concluded.',
      triggeredBy: 'USER',
      triggeredById: req.user._id
    });

    emitToTrip(trip._id, 'trip:completed', { tripId: trip._id });
    emitToUser(req.user._id, 'trip:completed', { tripId: trip._id });

    res.json({
      success: true,
      message: 'Arrived safely! Journey monitoring concluded.',
      trip
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/trips/:id/cancel
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const { reason = 'Cancelled by user' } = req.body;
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.user._id });
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    trip.status = 'cancelled';
    trip.cancelledAt = new Date();
    trip.cancellationReason = reason;
    trip.nextCheckInDueAt = null;
    await trip.save();

    await CheckIn.deleteMany({ tripId: trip._id, status: { $in: ['pending', 'grace_period'] } });

    await SafetyEvent.create({
      tripId: trip._id,
      userId: req.user._id,
      eventType: 'ALERT_CANCELLED',
      severity: 'info',
      title: 'Journey Cancelled',
      details: reason,
      triggeredBy: 'USER',
      triggeredById: req.user._id
    });

    emitToTrip(trip._id, 'trip:cancelled', { tripId: trip._id, reason });
    emitToUser(req.user._id, 'trip:cancelled', { tripId: trip._id, reason });

    res.json({
      success: true,
      message: 'Journey cancelled',
      trip
    });
  } catch (err) {
    next(err);
  }
});

export default router;
