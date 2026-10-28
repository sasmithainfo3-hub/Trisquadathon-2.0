import mongoose from 'mongoose';

const locationPointSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  accuracy: { type: Number, default: null }, // meters
  speed: { type: Number, default: null },
  heading: { type: Number, default: null },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const tripSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Trip title is required'],
    trim: true,
    maxlength: 120,
    default: 'Safe Journey'
  },
  startLocation: {
    address: { type: String, default: 'Current Location' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  destination: {
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  routeCoordinates: {
    type: [[Number]], // Array of [lat, lng] points for Leaflet polyline
    default: []
  },
  travelMode: {
    type: String,
    enum: ['walking', 'transit', 'driving', 'rideshare', 'cycling'],
    default: 'walking'
  },
  status: {
    type: String,
    enum: ['planned', 'active', 'completed', 'cancelled', 'escalated'],
    default: 'planned',
    index: true
  },
  startedAt: { type: Date, default: null },
  expectedArrivalAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancellationReason: { type: String, default: '' },
  checkInIntervalMinutes: {
    type: Number,
    required: true,
    default: 20,
    min: 5,
    max: 180
  },
  lastCheckInAt: { type: Date, default: null },
  nextCheckInDueAt: { type: Date, default: null, index: true },
  currentLocation: locationPointSchema,
  locationHistory: [locationPointSchema],
  currentAlertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    default: null
  },
  notes: {
    type: String,
    maxlength: 500,
    default: ''
  }
}, {
  timestamps: true
});

tripSchema.index({ userId: 1, status: 1 });
tripSchema.index({ status: 1, nextCheckInDueAt: 1 });

export const Trip = mongoose.model('Trip', tripSchema);
