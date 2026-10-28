import express from 'express';
import { SafetyEvent } from '../models/SafetyEvent.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/events
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { tripId, severity, eventType, limit = 50, page = 1 } = req.query;
    const query = { userId: req.user._id };

    if (tripId) query.tripId = tripId;
    if (severity) query.severity = severity;
    if (eventType) query.eventType = eventType;

    const events = await SafetyEvent.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('tripId', 'title destination');

    const total = await SafetyEvent.countDocuments(query);

    res.json({
      success: true,
      events,
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

export default router;
