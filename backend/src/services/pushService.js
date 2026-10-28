import webpush from 'web-push';
import { config } from '../config/env.js';
import { User } from '../models/User.js';

if (config.vapid.isConfigured) {
  try {
    webpush.setVapidDetails(
      config.vapid.subject,
      config.vapid.publicKey,
      config.vapid.privateKey
    );
    console.log('[SafePath WebPush] VAPID details configured successfully.');
  } catch (err) {
    console.warn('[SafePath WebPush] Failed to initialize VAPID credentials:', err.message);
  }
} else {
  console.log('[SafePath WebPush] Running in local mock mode (No VAPID keys set).');
}

export async function sendWebPushNotification(user, payload) {
  if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
    return { success: false, reason: 'No subscriptions found' };
  }

  if (!config.vapid.isConfigured) {
    console.log(`[SafePath WebPush MOCK] To user ${user.email} (${user._id}):`, payload);
    return { success: true, mode: 'local_mock', deliveredCount: user.pushSubscriptions.length };
  }

  const notificationPayload = JSON.stringify(payload);
  const activeSubs = [];
  let delivered = 0;
  let failed = 0;

  for (const sub of user.pushSubscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: sub.keys
      }, notificationPayload);
      activeSubs.push(sub);
      delivered++;
    } catch (err) {
      failed++;
      // If subscription expired or unsubscribed, omit it from activeSubs
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log(`[SafePath WebPush] Pruning expired push subscription: ${sub.endpoint}`);
      } else {
        // Keep subscription for transient network errors
        activeSubs.push(sub);
      }
    }
  }

  // Update user subscriptions if any were pruned
  if (activeSubs.length !== user.pushSubscriptions.length) {
    await User.updateOne({ _id: user._id }, { $set: { pushSubscriptions: activeSubs } });
  }

  return { success: delivered > 0, delivered, failed };
}
