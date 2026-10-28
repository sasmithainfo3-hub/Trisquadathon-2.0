import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recipientContactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrustedContact',
    default: null
  },
  type: {
    type: String,
    enum: [
      'ALERT_DISPATCHED',
      'CHECKIN_REMINDER',
      'CONTACT_INVITATION',
      'CONTACT_VERIFIED',
      'ALERT_ACKNOWLEDGED',
      'ALERT_ESCALATED',
      'ALERT_RESOLVED',
      'SECURITY_UPDATE',
      'SYSTEM'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 150
  },
  body: {
    type: String,
    required: true,
    maxlength: 500
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  channel: {
    type: String,
    enum: ['in_app', 'push', 'email', 'sms'],
    default: 'in_app'
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
