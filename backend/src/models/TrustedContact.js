import mongoose from 'mongoose';
import crypto from 'crypto';

const trustedContactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Contact name is required'],
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: [true, 'Contact email is required'],
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  relationship: {
    type: String,
    trim: true,
    default: 'Friend'
  },
  priorityOrder: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  },
  verificationToken: {
    type: String,
    default: () => crypto.randomBytes(24).toString('hex'),
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'declined'],
    default: 'pending'
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  canReceiveAlerts: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    maxlength: 500,
    default: ''
  }
}, {
  timestamps: true
});

// Compound index to ensure clean sorting per user
trustedContactSchema.index({ userId: 1, priorityOrder: 1 });
trustedContactSchema.index({ userId: 1, email: 1 });

export const TrustedContact = mongoose.model('TrustedContact', trustedContactSchema);
