/**
 * SafePath Silent-Mode Breakthrough Utility
 *
 * Allows critical safety reminder notifications (e.g., journey check-ins,
 * safety prompts) to sound through the device's Media Audio channel and vibrate
 * even when the physical phone switch is on Silent or Vibrate.
 */

let wakeLockSentinel = null;
let reminderAudioContext = null;

/**
 * Check if the user has enabled unsilent reminders (default: true).
 */
export function isBreakthroughEnabled() {
  try {
    const val = localStorage.getItem('safepath_unsilent_reminder_enabled');
    return val === null ? true : val === 'true';
  } catch (e) {
    return true;
  }
}

export function setBreakthroughEnabled(enabled) {
  try {
    localStorage.setItem('safepath_unsilent_reminder_enabled', enabled ? 'true' : 'false');
  } catch (e) {}
}

/**
 * Plays an audible melodic reminder chime via Web Audio API.
 * Uses the Media Audio channel (bypasses phone hardware ringer mute switch).
 */
export function playBreakthroughChime(type = 'checkin') {
  if (!isBreakthroughEnabled()) return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!reminderAudioContext || reminderAudioContext.state === 'closed') {
      reminderAudioContext = new AudioCtx();
    }

    if (reminderAudioContext.state === 'suspended') {
      reminderAudioContext.resume();
    }

    const now = reminderAudioContext.currentTime;

    // Harmonic 3-note melodic reminder chime (C5 -> E5 -> G5)
    // Clear, non-jarring but distinct enough to get attention in a pocket/bag
    const frequencies = type === 'warning' ? [659, 659, 880] : [523.25, 659.25, 783.99];
    const delays = [0, 0.16, 0.32];

    frequencies.forEach((freq, idx) => {
      const osc = reminderAudioContext.createOscillator();
      const gain = reminderAudioContext.createGain();

      osc.type = 'triangle'; // Soft bell / chime tone
      osc.frequency.setValueAtTime(freq, now + delays[idx]);

      gain.gain.setValueAtTime(0.001, now + delays[idx]);
      gain.gain.exponentialRampToValueAtTime(0.35, now + delays[idx] + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delays[idx] + 0.45);

      osc.connect(gain);
      gain.connect(reminderAudioContext.destination);

      osc.start(now + delays[idx]);
      osc.stop(now + delays[idx] + 0.48);
    });
  } catch (err) {
    console.warn('[SafePath Audio] Reminder chime error:', err);
  }
}

/**
 * Triggers multi-pulse haptic vibration to alert user in pocket/silent mode.
 */
export function triggerBreakthroughHaptics(pattern = [250, 100, 250, 100, 450]) {
  if (!isBreakthroughEnabled()) return;

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

/**
 * Keeps device screen awake during active journey monitoring so user doesn't miss prompts.
 */
export async function requestScreenWakeLock() {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return null;

  try {
    if (!wakeLockSentinel) {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
      console.log('[SafePath WakeLock] Screen wake lock acquired.');
    }
    return wakeLockSentinel;
  } catch (err) {
    console.warn('[SafePath WakeLock] Wake lock request error:', err.message);
    return null;
  }
}

export function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch (e) {}
    wakeLockSentinel = null;
    console.log('[SafePath WakeLock] Screen wake lock released.');
  }
}

/**
 * Combined breakthrough reminder execution:
 * Sounds media chime, pulses haptics, and shows system notification.
 */
export function triggerUnsilentReminder({ title, body, type = 'checkin' }) {
  // 1. Play media speaker chime
  playBreakthroughChime(type);

  // 2. Vibrate phone
  triggerBreakthroughHaptics();

  // 3. System Push/Local Notification with sound & vibration
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/safepath-icon.svg',
        silent: false,
        requireInteraction: true,
        vibrate: [250, 100, 250, 100, 450],
        tag: 'safepath-reminder'
      });
    } catch (e) {}
  }
}
