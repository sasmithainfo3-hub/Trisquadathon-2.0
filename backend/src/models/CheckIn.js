import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  scheduledAt: {
    type: Date,
    required: true,
    index: true
  },
  dueAt: {
    type: Date,
    required: true
  },
  graceExpiresAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'missed', 'grace_period'],
    default: 'pending',
    index: true
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    timestamp: { type: Date, default: null }
  },
  note: {
    type: String,
    maxlength: 300,
    default: ''
  }
}, {
  timestamps: true
});

checkInSchema.index({ tripId: 1, scheduledAt: 1 });
checkInSchema.index({ status: 1, graceExpiresAt: 1 });

export const CheckIn = mongoose.model('CheckIn', checkInSchema);
