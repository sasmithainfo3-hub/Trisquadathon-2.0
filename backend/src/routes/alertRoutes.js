import express from 'express';
import { z } from 'zod';
import { Alert } from '../models/Alert.js';
import { AlertAction } from '../models/AlertAction.js';
import { User } from '../models/User.js';
import { Trip } from '../models/Trip.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { emergencyLimiter } from '../middleware/rateLimiter.js';
import { triggerAlert, acknowledgeAlert, cancelAlert, resolveAlert } from '../services/safetyRelay.js';
import { config } from '../config/env.js';

const router = express.Router();

const manualAlertSchema = z.object({
  tripId: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional().nullable(),
  address: z.string().optional().default('Current Location'),
  explanation: z.string().optional().default('Manual Emergency SOS triggered by user.'),
  idempotencyKey: z.string().optional().nullable(),
  bypassGrace: z.boolean().optional().default(false)
});

const acknowledgeSchema = z.object({
  contactName: z.string().optional(),
  responseNote: z.string().max(500).optional().default('Confirmed. I am responding to this alert.')
});

const resolveSchema = z.object({
  resolutionNotes: z.string().max(500).optional().default('Emergency resolved safely.')
});

const cancelSchema = z.object({
  reason: z.string().max(300).optional().default('False alarm cancelled by user.')
});

// POST /api/v1/alerts/manual
router.post('/manual', requireAuth, emergencyLimiter, validate(manualAlertSchema), async (req, res, next) => {
  try {
    const { tripId, latitude, longitude, accuracy, address, explanation, idempotencyKey, bypassGrace } = req.body;

    const alert = await triggerAlert({
      userId: req.user._id,
      tripId: tripId || null,
      triggerReason: 'MANUAL_EMERGENCY',
      triggerExplanation: explanation,
      location: { latitude, longitude, accuracy, address, timestamp: new Date() },
      idempotencyKey,
      bypassGrace: bypassGrace !== false
    });

    const populatedAlert = await Alert.findById(alert._id).populate('currentContactId tripId');
    const alertUrl = `${config.clientUrl}/respond/${populatedAlert.publicAccessToken}`;
    const activeContact = populatedAlert.currentContactId;

    let whatsappUrl = null;
    let smsUrl = null;
    if (activeContact?.phone) {
      const cleanPhone = activeContact.phone.replace(/[^0-9+]/g, '');
      const waPhone = cleanPhone.replace(/^\+/, '');
      const text = `🚨 URGENT SAFEPATH ALERT: ${req.user.name} has triggered an emergency alert! Reason: ${explanation}. Live tracking & response: ${alertUrl}`;
      whatsappUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(waPhone)}&text=${encodeURIComponent(text)}`;
      smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;
    }

    res.status(201).json({
      success: true,
      message: 'Emergency alert initiated. Safety Relay is dispatching to your trusted contacts.',
      alert: populatedAlert,
      alertUrl,
      activeContact,
      whatsappUrl,
      smsUrl
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/alerts/active
router.get('/active', requireAuth, async (req, res, next) => {
  try {
    const alert = await Alert.findOne({
      userId: req.user._id,
      status: { $in: ['CREATED', 'DISPATCHING', 'NOTIFIED', 'ACKNOWLEDGED'] }
    }).populate('tripId currentContactId');

    let alertUrl = null;
    let whatsappUrl = null;
    let smsUrl = null;

    if (alert) {
      alertUrl = `${config.clientUrl}/respond/${alert.publicAccessToken}`;
      if (alert.currentContactId?.phone) {
        const cleanPhone = alert.currentContactId.phone.replace(/[^0-9+]/g, '');
        const waPhone = cleanPhone.replace(/^\+/, '');
        const text = `🚨 URGENT SAFEPATH ALERT: ${req.user.name} has triggered an emergency alert! Live tracking: ${alertUrl}`;
        whatsappUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(waPhone)}&text=${encodeURIComponent(text)}`;
        smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;
      }
    }

    res.json({
      success: true,
      alert,
      alertUrl,
      whatsappUrl,
      smsUrl
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/alerts/token/:publicAccessToken (Public endpoint for contacts)
router.get('/token/:publicAccessToken', async (req, res, next) => {
  try {
    const alert = await Alert.findOne({ publicAccessToken: req.params.publicAccessToken })
      .populate('userId', 'name phone')
      .populate('tripId')
      .populate('currentContactId', 'name relationship priorityOrder');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired alert access link.'
      });
    }

    const actions = await AlertAction.find({ alertId: alert._id })
      .populate('contactId', 'name priorityOrder')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      alert,
      actions
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/token/:publicAccessToken/acknowledge (Public endpoint for contacts)
router.post('/token/:publicAccessToken/acknowledge', validate(acknowledgeSchema), async (req, res, next) => {
  try {
    const { contactName, responseNote } = req.body;
    const alert = await acknowledgeAlert({
      publicAccessToken: req.params.publicAccessToken,
      contactName,
      responseNote
    });

    res.json({
      success: true,
      message: 'Thank you for acknowledging. The user has been notified that you are responding, and further escalation has been stopped.',
      alert
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/:id/resolve
router.post('/:id/resolve', requireAuth, validate(resolveSchema), async (req, res, next) => {
  try {
    const { resolutionNotes } = req.body;
    const alert = await resolveAlert({
      alertId: req.params.id,
      userId: req.user._id,
      resolutionNotes
    });

    res.json({
      success: true,
      message: 'Alert resolved successfully.',
      alert
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/:id/cancel
router.post('/:id/cancel', requireAuth, validate(cancelSchema), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const alert = await cancelAlert({
      alertId: req.params.id,
      userId: req.user._id,
      reason
    });

    res.json({
      success: true,
      message: 'Alert cancelled.',
      alert
    });
  } catch (err) {
    next(err);
  }
});

export default router;
