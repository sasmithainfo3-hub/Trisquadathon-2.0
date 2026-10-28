import mongoose from 'mongoose';
import crypto from 'crypto';

const alertSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    default: null,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  triggerReason: {
    type: String,
    enum: ['MISSED_CHECKIN', 'MANUAL_EMERGENCY', 'TIMEOUT', 'PANIC'],
    required: true
  },
  triggerExplanation: {
    type: String,
    required: true,
    default: 'Safety alert triggered.'
  },
  status: {
    type: String,
    enum: ['CREATED', 'DISPATCHING', 'NOTIFIED', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED', 'FAILED'],
    default: 'CREATED',
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'critical'
  },
  activeContactIndex: {
    type: Number,
    default: 0
  },
  currentContactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrustedContact',
    default: null
  },
  acknowledgedByContactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrustedContact',
    default: null
  },
  acknowledgedContactName: {
    type: String,
    default: null
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  responseNote: {
    type: String,
    default: ''
  },
  escalationTimeoutExpiresAt: {
    type: Date,
    default: null,
    index: true
  },
  escalationLevel: {
    type: Number,
    default: 1
  },
  cancellationGraceExpiresAt: {
    type: Date,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolutionNotes: {
    type: String,
    default: ''
  },
  aiIncidentSummary: {
    type: String,
    default: ''
  },
  lastKnownLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    address: { type: String, default: 'Unknown Location' },
    timestamp: { type: Date, default: Date.now }
  },
  idempotencyKey: {
    type: String,
    index: true,
    sparse: true
  },
  publicAccessToken: {
    type: String,
    required: true,
    default: () => crypto.randomBytes(32).toString('hex'),
    unique: true,
    index: true
  }
}, {
  timestamps: true
});

alertSchema.index({ status: 1, escalationTimeoutExpiresAt: 1 });
alertSchema.index({ userId: 1, status: 1 });

export const Alert = mongoose.model('Alert', alertSchema);
