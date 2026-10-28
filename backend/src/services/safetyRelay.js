import { Alert } from '../models/Alert.js';
import { Trip } from '../models/Trip.js';
import { User } from '../models/User.js';
import { TrustedContact } from '../models/TrustedContact.js';
import { AlertAction } from '../models/AlertAction.js';
import { SafetyEvent } from '../models/SafetyEvent.js';
import { Notification } from '../models/Notification.js';
import { sendEmail, generateAlertEmail } from './emailService.js';
import { sendSms } from './smsService.js';
import { sendWebPushNotification } from './pushService.js';
import { generateIncidentSummary } from './aiService.js';
import { emitToUser, emitToTrip, emitToAlert } from '../config/socket.js';

export async function triggerAlert({
  userId,
  tripId = null,
  triggerReason,
  triggerExplanation,
  location,
  idempotencyKey = null,
  bypassGrace = false
}) {
  // Idempotency check: if an alert was already initiated with this key, return it
  if (idempotencyKey) {
    const existing = await Alert.findOne({ idempotencyKey });
    if (existing) {
      return existing;
    }
  }

  // Deduplicate: If an active alert already exists for this trip or user, return it
  const activeExisting = await Alert.findOne({
    userId,
    ...(tripId ? { tripId } : {}),
    status: { $in: ['CREATED', 'DISPATCHING', 'NOTIFIED', 'ACKNOWLEDGED'] }
  });
  if (activeExisting) {
    return activeExisting;
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const trip = tripId ? await Trip.findById(tripId) : null;
  const lastLocation = location || trip?.currentLocation || { latitude: 0, longitude: 0, address: 'Unknown' };

  // Calculate cancellation grace period for manual panic (if configured and not bypassed)
  const graceSeconds = bypassGrace ? 0 : (user.preferences?.emergencyGracePeriodSeconds || 10);
  const cancellationGraceExpiresAt = graceSeconds > 0 ? new Date(Date.now() + graceSeconds * 1000) : null;

  // Generate objective incident summary (OpenAI or deterministic fallback)
  const aiIncidentSummary = await generateIncidentSummary({
    userName: user.name,
    triggerReason,
    trip,
    lastLocation,
    triggerExplanation
  });

  const alert = await Alert.create({
    tripId: trip?._id || null,
    userId: user._id,
    triggerReason,
    triggerExplanation: triggerExplanation || 'Safety alert initiated.',
    status: cancellationGraceExpiresAt ? 'CREATED' : 'DISPATCHING',
    severity: 'critical',
    cancellationGraceExpiresAt,
    lastKnownLocation: {
      latitude: lastLocation.latitude,
      longitude: lastLocation.longitude,
      accuracy: lastLocation.accuracy || null,
      address: lastLocation.address || 'Reported Location',
      timestamp: lastLocation.timestamp || new Date()
    },
    aiIncidentSummary,
    idempotencyKey
  });

  if (trip) {
    trip.status = 'escalated';
    trip.currentAlertId = alert._id;
    await trip.save();
  }

  // Record safety event
  await SafetyEvent.create({
    tripId: trip?._id || null,
    alertId: alert._id,
    userId: user._id,
    eventType: triggerReason === 'MANUAL_EMERGENCY' ? 'MANUAL_EMERGENCY' : 'ALERT_CREATED',
    severity: 'critical',
    title: triggerReason === 'MANUAL_EMERGENCY' ? 'Emergency SOS Triggered' : 'Check-In Missed Alert Triggered',
    details: alert.triggerExplanation,
    location: alert.lastKnownLocation,
    triggeredBy: 'USER',
    triggeredById: user._id
  });

  // Create in-app notification
  await Notification.create({
    userId: user._id,
    type: 'ALERT_DISPATCHED',
    title: 'Safety Alert Active',
    body: alert.triggerExplanation,
    data: { alertId: alert._id, triggerReason }
  });

  // Real-time broadcast
  emitToUser(user._id, 'alert:created', { alert, tripId: trip?._id });
  if (trip) {
    emitToTrip(trip._id, 'trip:escalated', { tripId: trip._id, alertId: alert._id });
  }

  // If there is no cancellation grace period, dispatch immediately
  if (!cancellationGraceExpiresAt) {
    await dispatchAlert(alert);
  }

  return alert;
}

export async function dispatchAlert(alert) {
  const user = await User.findById(alert.userId);
  const trip = alert.tripId ? await Trip.findById(alert.tripId) : null;
  if (!user) return;

  // Retrieve ALL contacts in the user's safety circle sorted by priorityOrder
  const contacts = await TrustedContact.find({
    userId: user._id,
    canReceiveAlerts: true
  }).sort({ priorityOrder: 1 });

  if (contacts.length === 0) {
    console.warn(`[SafePath SafetyRelay] No contacts configured for user ${user._id}`);
    alert.status = 'NOTIFIED';
    alert.triggerExplanation += ' (Notice: Add contacts to your Safety Circle for automated delivery)';
    await alert.save();

    emitToUser(user._id, 'alert:dispatched', { alertId: alert._id, alert, contact: null });
    return;
  }

  const targetIndex = alert.activeContactIndex < contacts.length ? alert.activeContactIndex : 0;
  const contact = contacts[targetIndex];

  // Set timeout before escalation to the next contact
  const timeoutMinutes = user.preferences?.defaultEscalationTimeoutMinutes || 10;
  alert.currentContactId = contact._id;
  alert.status = 'NOTIFIED';
  alert.escalationTimeoutExpiresAt = new Date(Date.now() + timeoutMinutes * 60000);
  await alert.save();

  // Dispatch Email
  if (user.preferences?.notifyEmail !== false) {
    const emailData = generateAlertEmail(alert, user, contact, trip);
    const emailRes = await sendEmail(emailData);

    await AlertAction.create({
      alertId: alert._id,
      contactId: contact._id,
      channel: 'email',
      recipient: contact.email,
      attemptNumber: alert.escalationLevel || 1,
      status: emailRes.success ? 'sent' : 'failed',
      providerMessageId: emailRes.id || null,
      error: emailRes.error || null,
      sentAt: new Date()
    });
  }

  // Dispatch SMS (if enabled in preferences and configured)
  if (user.preferences?.notifySms && contact.phone) {
    const alertUrl = `https://safepath.app/respond/${alert.publicAccessToken}`;
    const smsRes = await sendSms({
      to: contact.phone,
      message: `SAFEPATH URGENT: Safety alert for ${user.name}. Reason: ${alert.triggerReason}. Acknowledge response here: ${alertUrl}`
    });

    await AlertAction.create({
      alertId: alert._id,
      contactId: contact._id,
      channel: 'sms',
      recipient: contact.phone,
      attemptNumber: alert.escalationLevel || 1,
      status: smsRes.success ? 'sent' : 'failed',
      providerMessageId: smsRes.sid || null,
      error: smsRes.error || null,
      sentAt: new Date()
    });
  }

  // Web Push to User's own devices confirming dispatch
  await sendWebPushNotification(user, {
    title: 'SafePath Alert Dispatched',
    body: `Notified ${contact.name} (Priority #${contact.priorityOrder}). Awaiting acknowledgment.`,
    url: `/trips/${trip?._id || ''}`
  });

  // Record SafetyEvent
  await SafetyEvent.create({
    tripId: alert.tripId,
    alertId: alert._id,
    userId: user._id,
    eventType: 'NOTIFICATION_SENT',
    severity: 'critical',
    title: `Alert Dispatched to ${contact.name}`,
    details: `Notified contact #${contact.priorityOrder} (${contact.name}) via email${contact.phone ? ' and SMS' : ''}. Escalation timeout: ${timeoutMinutes} minutes.`,
    location: alert.lastKnownLocation,
    triggeredBy: 'SYSTEM_TIMER'
  });

  // Real-time broadcasts
  emitToAlert(alert._id, 'alert:dispatched', { alert, contactName: contact.name });
  emitToUser(user._id, 'alert:dispatched', { alert, contactName: contact.name });
}

export async function escalateAlert(alert) {
  const user = await User.findById(alert.userId);
  if (!user) return;

  const contacts = await TrustedContact.find({
    userId: user._id,
    canReceiveAlerts: true
  }).sort({ priorityOrder: 1 });

  const nextIndex = alert.activeContactIndex + 1;

  if (nextIndex < contacts.length) {
    const prevContact = contacts[alert.activeContactIndex];
    const nextContact = contacts[nextIndex];

    alert.activeContactIndex = nextIndex;
    alert.escalationLevel = (alert.escalationLevel || 1) + 1;
    alert.status = 'DISPATCHING';
    await alert.save();

    await SafetyEvent.create({
      tripId: alert.tripId,
      alertId: alert._id,
      userId: user._id,
      eventType: 'ALERT_ESCALATED',
      severity: 'critical',
      title: `Escalated to ${nextContact.name}`,
      details: `Contact #${prevContact.priorityOrder} (${prevContact.name}) did not acknowledge within the timeout. Escalating to Priority #${nextContact.priorityOrder} (${nextContact.name}).`,
      location: alert.lastKnownLocation,
      triggeredBy: 'SYSTEM_TIMER'
    });

    emitToAlert(alert._id, 'alert:escalated', {
      alertId: alert._id,
      escalationLevel: alert.escalationLevel,
      nextContactName: nextContact.name
    });
    emitToUser(user._id, 'alert:escalated', {
      alertId: alert._id,
      escalationLevel: alert.escalationLevel,
      nextContactName: nextContact.name
    });

    await dispatchAlert(alert);
  } else {
    // All contacts exhausted without acknowledgment - cycle back or broadcast reminder
    console.warn(`[SafePath SafetyRelay] All contacts exhausted for alert ${alert._id}`);
    alert.escalationTimeoutExpiresAt = new Date(Date.now() + 15 * 60000); // Check again in 15 mins
    await alert.save();

    await SafetyEvent.create({
      tripId: alert.tripId,
      alertId: alert._id,
      userId: user._id,
      eventType: 'ALERT_ESCALATED',
      severity: 'critical',
      title: 'All Contacts Alerted - Awaiting Response',
      details: 'All verified trusted contacts in the safety circle have been notified. Relay will send periodic reminders.',
      triggeredBy: 'SYSTEM_TIMER'
    });
  }
}

export async function cancelAlert({ alertId, userId, reason = 'False alarm cancelled by user' }) {
  const alert = await Alert.findById(alertId);
  if (!alert) throw new Error('Alert not found');

  if (String(alert.userId) !== String(userId)) {
    throw new Error('Unauthorized to cancel this alert');
  }

  if (['RESOLVED', 'CANCELLED'].includes(alert.status)) {
    return alert;
  }

  alert.status = 'CANCELLED';
  alert.resolutionNotes = reason;
  alert.escalationTimeoutExpiresAt = null;
  alert.cancellationGraceExpiresAt = null;
  await alert.save();

  if (alert.tripId) {
    const trip = await Trip.findById(alert.tripId);
    if (trip && trip.status === 'escalated') {
      trip.status = 'active';
      await trip.save();
    }
  }

  await SafetyEvent.create({
    tripId: alert.tripId,
    alertId: alert._id,
    userId: alert.userId,
    eventType: 'ALERT_CANCELLED',
    severity: 'info',
    title: 'Alert Cancelled',
    details: reason,
    location: alert.lastKnownLocation,
    triggeredBy: 'USER',
    triggeredById: userId
  });

  emitToAlert(alert._id, 'alert:cancelled', { alertId: alert._id, reason });
  emitToUser(alert.userId, 'alert:cancelled', { alertId: alert._id, reason });

  return alert;
}

export async function acknowledgeAlert({ publicAccessToken, contactName, responseNote }) {
  const alert = await Alert.findOne({ publicAccessToken });
  if (!alert) throw new Error('Invalid alert access token');

  if (['RESOLVED', 'CANCELLED'].includes(alert.status)) {
    return alert;
  }

  const currentContact = alert.currentContactId ? await TrustedContact.findById(alert.currentContactId) : null;
  if (currentContact && currentContact.status !== 'verified') {
    currentContact.status = 'verified';
    currentContact.verifiedAt = new Date();
    await currentContact.save();
  }

  alert.status = 'ACKNOWLEDGED';
  alert.acknowledgedAt = new Date();
  alert.acknowledgedContactName = contactName || currentContact?.name || 'Trusted Contact';
  alert.acknowledgedByContactId = currentContact?._id || null;
  alert.responseNote = responseNote || 'Contact confirmed they are responding.';
  alert.escalationTimeoutExpiresAt = null; // Stop further escalation!
  await alert.save();

  await SafetyEvent.create({
    tripId: alert.tripId,
    alertId: alert._id,
    userId: alert.userId,
    eventType: 'ALERT_ACKNOWLEDGED',
    severity: 'medium',
    title: `Alert Acknowledged by ${alert.acknowledgedContactName}`,
    details: alert.responseNote,
    location: alert.lastKnownLocation,
    triggeredBy: 'CONTACT',
    triggeredById: alert.acknowledgedByContactId
  });

  await Notification.create({
    userId: alert.userId,
    type: 'ALERT_ACKNOWLEDGED',
    title: 'Alert Acknowledged',
    body: `${alert.acknowledgedContactName} has acknowledged your safety alert and is responding: "${alert.responseNote}"`,
    data: { alertId: alert._id }
  });

  emitToAlert(alert._id, 'alert:acknowledged', {
    alertId: alert._id,
    contactName: alert.acknowledgedContactName,
    responseNote: alert.responseNote,
    acknowledgedAt: alert.acknowledgedAt
  });
  emitToUser(alert.userId, 'alert:acknowledged', {
    alertId: alert._id,
    contactName: alert.acknowledgedContactName,
    responseNote: alert.responseNote,
    acknowledgedAt: alert.acknowledgedAt
  });

  return alert;
}

export async function resolveAlert({ alertId, userId, resolutionNotes = 'Incident resolved safely' }) {
  const alert = await Alert.findById(alertId);
  if (!alert) throw new Error('Alert not found');

  if (String(alert.userId) !== String(userId)) {
    throw new Error('Unauthorized to resolve this alert');
  }

  alert.status = 'RESOLVED';
  alert.resolvedAt = new Date();
  alert.resolvedByUserId = userId;
  alert.resolutionNotes = resolutionNotes;
  alert.escalationTimeoutExpiresAt = null;
  await alert.save();

  if (alert.tripId) {
    const trip = await Trip.findById(alert.tripId);
    if (trip && trip.status === 'escalated') {
      trip.status = 'completed';
      trip.completedAt = new Date();
      await trip.save();
    }
  }

  await SafetyEvent.create({
    tripId: alert.tripId,
    alertId: alert._id,
    userId: alert.userId,
    eventType: 'ALERT_RESOLVED',
    severity: 'info',
    title: 'Alert Resolved',
    details: resolutionNotes,
    location: alert.lastKnownLocation,
    triggeredBy: 'USER',
    triggeredById: userId
  });

  emitToAlert(alert._id, 'alert:resolved', { alertId: alert._id, resolutionNotes });
  emitToUser(alert.userId, 'alert:resolved', { alertId: alert._id, resolutionNotes });

  return alert;
}
