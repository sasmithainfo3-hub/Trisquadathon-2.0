import express from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendWebPushNotification } from '../services/pushService.js';

const router = express.Router();

const subscriptionSchema = z.object({
  endpoint: z.string().url('Valid push endpoint URL required'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

// GET /api/v1/push/vapid-key
router.get('/vapid-key', (req, res) => {
  res.json({
    success: true,
    publicKey: config.vapid.publicKey,
    isConfigured: config.vapid.isConfigured
  });
});

// POST /api/v1/push/subscribe
router.post('/subscribe', requireAuth, validate(subscriptionSchema), async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;

    const user = await User.findById(req.user._id);
    const existingIndex = user.pushSubscriptions.findIndex((s) => s.endpoint === endpoint);

    if (existingIndex >= 0) {
      user.pushSubscriptions[existingIndex] = { endpoint, keys, createdAt: new Date() };
    } else {
      user.pushSubscriptions.push({ endpoint, keys, createdAt: new Date() });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Push notification subscription registered successfully'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/push/test
router.post('/test', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const result = await sendWebPushNotification(user, {
      title: 'SafePath Test Notification',
      body: 'Web push is working properly on this device.',
      url: '/dashboard'
    });

    res.json({
      success: true,
      message: 'Test notification dispatched',
      result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
