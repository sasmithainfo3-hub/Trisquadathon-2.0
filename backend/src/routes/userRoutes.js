import express from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Trip } from '../models/Trip.js';
import { TrustedContact } from '../models/TrustedContact.js';
import { CheckIn } from '../models/CheckIn.js';
import { Alert } from '../models/Alert.js';
import { SafetyEvent } from '../models/SafetyEvent.js';
import { Notification } from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { recordAuditLog } from '../services/auditService.js';

const router = express.Router();

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional()
});

const updatePreferencesSchema = z.object({
  checkInGracePeriodMinutes: z.number().int().min(1).max(60).optional(),
  defaultEscalationTimeoutMinutes: z.number().int().min(2).max(120).optional(),
  emergencyGracePeriodSeconds: z.number().int().min(0).max(60).optional(),
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  dataRetentionDays: z.number().int().min(7).max(365).optional()
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password confirmation is required')
});

// GET /api/v1/users/profile
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/profile
router.put('/profile', requireAuth, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.name) user.name = req.body.name;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    await user.save();

    await recordAuditLog({
      userId: user._id,
      action: 'UPDATE_PROFILE',
      resourceType: 'User',
      resourceId: user._id,
      req
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        preferences: user.preferences
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/preferences
router.put('/preferences', requireAuth, validate(updatePreferencesSchema), async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (req.body.dataRetentionDays !== undefined) {
      user.dataRetentionDays = req.body.dataRetentionDays;
    }

    user.preferences = {
      ...user.preferences,
      ...req.body
    };

    await user.save();

    await recordAuditLog({
      userId: user._id,
      action: 'UPDATE_PREFERENCES',
      resourceType: 'User',
      resourceId: user._id,
      req,
      details: req.body
    });

    res.json({
      success: true,
      message: 'Safety preferences updated successfully',
      preferences: user.preferences,
      dataRetentionDays: user.dataRetentionDays
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/export
router.get('/export', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [user, contacts, trips, events] = await Promise.all([
      User.findById(userId).select('-passwordHash -resetPasswordToken -resetPasswordExpires'),
      TrustedContact.find({ userId }),
      Trip.find({ userId }),
      SafetyEvent.find({ userId })
    ]);

    await recordAuditLog({
      userId,
      action: 'EXPORT_PERSONAL_DATA',
      resourceType: 'User',
      resourceId: userId,
      req
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=safepath-data-${userId}.json`);

    res.json({
      exportedAt: new Date().toISOString(),
      user,
      contacts,
      trips,
      events
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/users/account
router.delete('/account', requireAuth, validate(deleteAccountSchema), async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Account deletion aborted.'
      });
    }

    const userId = user._id;

    // Delete cascading resources
    await Promise.all([
      Trip.deleteMany({ userId }),
      CheckIn.deleteMany({ userId }),
      TrustedContact.deleteMany({ userId }),
      Alert.deleteMany({ userId }),
      SafetyEvent.deleteMany({ userId }),
      Notification.deleteMany({ userId }),
      User.findByIdAndDelete(userId)
    ]);

    await recordAuditLog({
      userId: null,
      action: 'DELETE_ACCOUNT',
      resourceType: 'User',
      resourceId: userId,
      req,
      details: { deletedEmail: user.email }
    });

    res.clearCookie('token');

    res.json({
      success: true,
      message: 'Your account and all associated personal data have been permanently deleted.'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
