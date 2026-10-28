import mongoose from 'mongoose';

const alertActionSchema = new mongoose.Schema({
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    required: true,
    index: true
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrustedContact',
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['email', 'push', 'sms', 'in_app'],
    required: true
  },
  recipient: {
    type: String,
    required: true
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'skipped'],
    default: 'pending',
    index: true
  },
  providerMessageId: {
    type: String,
    default: null
  },
  providerResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  sentAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

alertActionSchema.index({ alertId: 1, contactId: 1, channel: 1 });

export const AlertAction = mongoose.model('AlertAction', alertActionSchema);
