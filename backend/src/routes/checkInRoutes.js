import express from 'express';
import { z } from 'zod';
import { CheckIn } from '../models/CheckIn.js';
import { Trip } from '../models/Trip.js';
import { SafetyEvent } from '../models/SafetyEvent.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { emitToUser, emitToTrip } from '../config/socket.js';

const router = express.Router();

const acknowledgeCheckInSchema = z.object({
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  accuracy: z.number().optional().nullable(),
  note: z.string().max(300).optional().default('')
});

// GET /api/v1/check-ins/trip/:tripId
router.get('/trip/:tripId', requireAuth, async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.tripId, userId: req.user._id });
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    const checkIns = await CheckIn.find({ tripId: trip._id }).sort({ scheduledAt: 1 });
    res.json({
      success: true,
      checkIns
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/check-ins/:id/acknowledge
router.post('/:id/acknowledge', requireAuth, validate(acknowledgeCheckInSchema), async (req, res, next) => {
  try {
    const checkIn = await CheckIn.findOne({ _id: req.params.id, userId: req.user._id });
    if (!checkIn) {
      return res.status(404).json({ success: false, message: 'Check-in not found' });
    }

    if (checkIn.status === 'completed') {
      return res.json({ success: true, message: 'Check-in was already confirmed', checkIn });
    }

    const now = new Date();
    checkIn.status = 'completed';
    checkIn.acknowledgedAt = now;
    if (req.body.latitude && req.body.longitude) {
      checkIn.location = {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        accuracy: req.body.accuracy || null,
        timestamp: now
      };
    }
    checkIn.note = req.body.note || '';
    await checkIn.save();

    const trip = await Trip.findById(checkIn.tripId);
    let nextCheckIn = null;

    if (trip && trip.status === 'active') {
      trip.lastCheckInAt = now;

      // Schedule next check-in
      const intervalMinutes = trip.checkInIntervalMinutes;
      const nextDue = new Date(now.getTime() + intervalMinutes * 60000);
      const graceMinutes = req.user.preferences?.checkInGracePeriodMinutes || 5;
      const nextGrace = new Date(nextDue.getTime() + graceMinutes * 60000);

      trip.nextCheckInDueAt = nextDue;
      await trip.save();

      nextCheckIn = await CheckIn.create({
        tripId: trip._id,
        userId: req.user._id,
        scheduledAt: nextDue,
        dueAt: nextDue,
        graceExpiresAt: nextGrace,
        status: 'pending'
      });
    }

    await SafetyEvent.create({
      tripId: checkIn.tripId,
      userId: req.user._id,
      eventType: 'CHECKIN_COMPLETED',
      severity: 'info',
      title: 'Safety Check-In Confirmed',
      details: `User confirmed safe at ${now.toLocaleTimeString()}.${nextCheckIn ? ` Next check-in scheduled for ${nextCheckIn.dueAt.toLocaleTimeString()}.` : ''}`,
      location: checkIn.location,
      triggeredBy: 'USER',
      triggeredById: req.user._id
    });

    emitToTrip(checkIn.tripId, 'checkin:completed', { checkIn, nextCheckIn });
    emitToUser(req.user._id, 'checkin:completed', { checkIn, nextCheckIn });

    res.json({
      success: true,
      message: 'Check-in confirmed successfully! Safe journey.',
      checkIn,
      nextCheckIn
    });
  } catch (err) {
    next(err);
  }
});

export default router;
