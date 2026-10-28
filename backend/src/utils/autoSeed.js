import { User } from '../models/User.js';
import { TrustedContact } from '../models/TrustedContact.js';
import { Trip } from '../models/Trip.js';
import { CheckIn } from '../models/CheckIn.js';
import { SafetyEvent } from '../models/SafetyEvent.js';
import { calculateRoute } from '../services/routeService.js';

export async function ensureDemoData() {
  try {
    const existing = await User.findOne({ email: 'maya@safepath.app' });
    if (existing) {
      console.log('[SafePath AutoSeed] Demo user maya@safepath.app already exists.');
      return;
    }

    console.log('[SafePath AutoSeed] Initializing demo user and safety network...');
    const passwordHash = await User.hashPassword('SafePath123!');
    const user = await User.create({
      name: 'Maya Patel',
      email: 'maya@safepath.app',
      passwordHash,
      phone: '+15550192834',
      preferences: {
        checkInGracePeriodMinutes: 5,
        defaultEscalationTimeoutMinutes: 10,
        emergencyGracePeriodSeconds: 10,
        notifyEmail: true,
        notifyPush: true,
        notifySms: true
      },
      dataRetentionDays: 30
    });

    const aria = await User.create({
      name: 'Aria Traveler',
      email: 'aria.demo@safepath.local',
      passwordHash,
      phone: '+15550192839',
      preferences: {
        checkInGracePeriodMinutes: 5,
        defaultEscalationTimeoutMinutes: 10,
        emergencyGracePeriodSeconds: 10,
        notifyEmail: true,
        notifyPush: true,
        notifySms: true
      },
      dataRetentionDays: 30
    });

    const contacts = await TrustedContact.insertMany([
      {
        userId: user._id,
        name: 'Elena Rostova',
        email: 'elena@example.com',
        phone: '+15550199991',
        relationship: 'Sister',
        priorityOrder: 1,
        status: 'verified',
        verifiedAt: new Date(),
        canReceiveAlerts: true,
        notes: 'Lives 10 minutes away, has spare house key.'
      },
      {
        userId: user._id,
        name: 'Marcus Chen',
        email: 'marcus@example.com',
        phone: '+15550199992',
        relationship: 'Partner',
        priorityOrder: 2,
        status: 'verified',
        verifiedAt: new Date(),
        canReceiveAlerts: true,
        notes: 'Primary emergency contact during evening hours.'
      },
      {
        userId: user._id,
        name: 'Sarah Jenkins',
        email: 'sarah@example.com',
        phone: '+15550199993',
        relationship: 'Roommate',
        priorityOrder: 3,
        status: 'verified',
        verifiedAt: new Date(),
        canReceiveAlerts: true,
        notes: 'Available if Elena or Marcus do not respond.'
      }
    ]);

    const startLocation = {
      address: 'Metropolitan Art Center, Downtown',
      latitude: 37.7749,
      longitude: -122.4194
    };
    const destination = {
      address: '452 Willow Creek Apartments, Uptown',
      latitude: 37.7833,
      longitude: -122.4167
    };

    const route = await calculateRoute({ start: startLocation, destination, travelMode: 'walking' });
    const now = new Date();
    const nextDue = new Date(now.getTime() + 15 * 60000);
    const graceExpires = new Date(nextDue.getTime() + 5 * 60000);

    const trip = await Trip.create({
      userId: user._id,
      title: 'Evening Walk Home from Gallery',
      startLocation,
      destination,
      routeCoordinates: route.coordinates,
      travelMode: 'walking',
      status: 'active',
      startedAt: now,
      expectedArrivalAt: new Date(now.getTime() + 45 * 60000),
      checkInIntervalMinutes: 15,
      nextCheckInDueAt: nextDue,
      currentLocation: {
        latitude: 37.7765,
        longitude: -122.4188,
        accuracy: 8,
        timestamp: now
      },
      notes: 'Taking the well-lit avenue pathway.'
    });

    await CheckIn.create({
      tripId: trip._id,
      userId: user._id,
      scheduledAt: nextDue,
      dueAt: nextDue,
      graceExpiresAt: graceExpires,
      status: 'pending'
    });

    await SafetyEvent.create({
      tripId: trip._id,
      userId: user._id,
      eventType: 'TRIP_STARTED',
      severity: 'info',
      title: 'Journey Started',
      details: 'Evening walk home started. First check-in due in 15 minutes.',
      location: trip.currentLocation,
      triggeredBy: 'USER',
      triggeredById: user._id
    });

    console.log(`[SafePath AutoSeed] Successfully seeded Maya Patel (${contacts.length} verified contacts, active trip).`);
  } catch (err) {
    console.error('[SafePath AutoSeed] Error creating demo data:', err);
  }
}
