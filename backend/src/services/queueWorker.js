import { CheckIn } from '../models/CheckIn.js';
import { Trip } from '../models/Trip.js';
import { Alert } from '../models/Alert.js';
import { User } from '../models/User.js';
import { triggerAlert, dispatchAlert, escalateAlert } from './safetyRelay.js';
import { emitToUser, emitToTrip } from '../config/socket.js';
import { sendWebPushNotification } from './pushService.js';

let intervalTimer = null;
let isProcessing = false;

export async function processQueueCycle() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();

    // 1. Check-In Grace Period Warnings
    const enteringGrace = await CheckIn.find({
      status: 'pending',
      dueAt: { $lte: now },
      graceExpiresAt: { $gt: now }
    }).populate('userId');

    for (const checkIn of enteringGrace) {
      checkIn.status = 'grace_period';
      await checkIn.save();

      emitToUser(checkIn.userId._id, 'checkin:grace_warning', {
        checkInId: checkIn._id,
        tripId: checkIn.tripId,
        graceExpiresAt: checkIn.graceExpiresAt
      });

      await sendWebPushNotification(checkIn.userId, {
        title: 'Check-In Due (Grace Period Active)',
        body: 'Please tap to confirm you are safe before your safety contacts are notified.',
        url: `/trips/${checkIn.tripId}`
      });
    }

    // 2. Missed Check-Ins (Grace period expired)
    const missedCheckIns = await CheckIn.find({
      status: { $in: ['pending', 'grace_period'] },
      graceExpiresAt: { $lte: now }
    }).populate('tripId userId');

    for (const checkIn of missedCheckIns) {
      checkIn.status = 'missed';
      await checkIn.save();

      const trip = checkIn.tripId;
      const user = checkIn.userId;

      if (trip && trip.status === 'active') {
        const explanation = `Safety check-in scheduled for ${new Date(checkIn.scheduledAt).toLocaleTimeString()} was missed after grace period expired at ${new Date(checkIn.graceExpiresAt).toLocaleTimeString()}.`;

        await triggerAlert({
          userId: user._id,
          tripId: trip._id,
          triggerReason: 'MISSED_CHECKIN',
          triggerExplanation: explanation,
          location: trip.currentLocation || trip.startLocation,
          idempotencyKey: `checkin-${checkIn._id}`,
          bypassGrace: false
        });
      }
    }

    // 3. Alerts in CREATED status whose cancellation grace period expired
    const readyToDispatchAlerts = await Alert.find({
      status: 'CREATED',
      cancellationGraceExpiresAt: { $lte: now }
    });

    for (const alert of readyToDispatchAlerts) {
      alert.status = 'DISPATCHING';
      await alert.save();
      await dispatchAlert(alert);
    }

    // 4. Alerts in NOTIFIED status whose escalation timeout has expired
    const expiredAlerts = await Alert.find({
      status: 'NOTIFIED',
      escalationTimeoutExpiresAt: { $lte: now }
    });

    for (const alert of expiredAlerts) {
      console.log(`[SafePath Queue] Alert ${alert._id} escalation timeout reached. Escalating...`);
      await escalateAlert(alert);
    }

  } catch (err) {
    console.error('[SafePath Queue Worker] Error during cycle processing:', err);
  } finally {
    isProcessing = false;
  }
}

export function startQueueWorker(intervalMs = 5000) {
  if (intervalTimer) {
    clearInterval(intervalTimer);
  }
  console.log(`[SafePath Queue Worker] Started with polling interval ${intervalMs}ms.`);
  intervalTimer = setInterval(processQueueCycle, intervalMs);
}

export function stopQueueWorker() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
    console.log('[SafePath Queue Worker] Stopped.');
  }
}
