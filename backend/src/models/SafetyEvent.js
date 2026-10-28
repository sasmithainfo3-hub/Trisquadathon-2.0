import mongoose from 'mongoose';

const safetyEventSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    default: null,
    index: true
  },
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    default: null,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: [
      'TRIP_PLANNED',
      'TRIP_STARTED',
      'CHECKIN_SCHEDULED',
      'CHECKIN_COMPLETED',
      'CHECKIN_MISSED',
      'CHECKIN_GRACE_PERIOD',
      'MANUAL_EMERGENCY',
      'ALERT_CREATED',
      'NOTIFICATION_SENT',
      'NOTIFICATION_FAILED',
      'ALERT_ACKNOWLEDGED',
      'ALERT_ESCALATED',
      'ALERT_RESOLVED',
      'ALERT_CANCELLED',
      'TRIP_COMPLETED',
      'LOCATION_PING'
    ],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'low', 'medium', 'high', 'critical'],
    default: 'info'
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  details: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    address: { type: String, default: null },
    timestamp: { type: Date, default: null }
  },
  triggeredBy: {
    type: String,
    enum: ['USER', 'SYSTEM_TIMER', 'CONTACT', 'ADMIN'],
    default: 'USER'
  },
  triggeredById: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  }
}, {
  timestamps: true
});

safetyEventSchema.index({ userId: 1, createdAt: -1 });
safetyEventSchema.index({ tripId: 1, createdAt: 1 });

export const SafetyEvent = mongoose.model('SafetyEvent', safetyEventSchema);
