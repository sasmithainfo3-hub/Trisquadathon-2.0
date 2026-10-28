import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  X,
  Send,
  CheckCircle2,
  Volume2,
  VolumeX,
  MessageCircle,
  ExternalLink,
  Share2,
  Phone,
  Clock,
  Copy,
  Check,
  Mail
} from 'lucide-react';
import { api } from '../utils/api';
import { getSocket, joinRoom, leaveRoom } from '../utils/socket';
import { enqueueOfflineEvent } from '../utils/idbQueue';
import { useAuth } from '../context/AuthContext';

// Web Audio API Emergency Siren generator
let sirenInterval = null;
let audioContext = null;

function startSiren() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    let high = false;
    if (sirenInterval) clearInterval(sirenInterval);

    sirenInterval = setInterval(() => {
      if (!audioContext || audioContext.state === 'closed') return;
      try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(high ? 1300 : 900, audioContext.currentTime);
        gain.gain.setValueAtTime(0.12, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.32);
        osc.start();
        osc.stop(audioContext.currentTime + 0.32);
        high = !high;
      } catch (e) {}
    }, 350);
  } catch (e) {
    console.warn('Audio siren start error:', e);
  }
}

function stopSiren() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  if (audioContext) {
    try {
      audioContext.close();
    } catch (e) {}
    audioContext = null;
  }
}

export default function SOSModal({ isOpen, onClose, tripId, currentLocation, onAlertTriggered }) {
  const { user, isOnline } = useAuth();
  const graceSeconds = user?.preferences?.emergencyGracePeriodSeconds || 10;

  const [countdown, setCountdown] = useState(graceSeconds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dispatchedAlert, setDispatchedAlert] = useState(null);
  const [alertMeta, setAlertMeta] = useState(null);
  const [acknowledgedData, setAcknowledgedData] = useState(null);
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState(null);

  // Auto-dispatch emergency immediately upon opening
  useEffect(() => {
    if (!isOpen) {
      setDispatchedAlert(null);
      setAlertMeta(null);
      setAcknowledgedData(null);
      setError(null);
      stopSiren();
      setSirenPlaying(false);
      return;
    }

    // Immediately trigger emergency dispatch without manual delay!
    executeDispatch(true);
  }, [isOpen]);

  // Clean up siren on unmount
  useEffect(() => {
    return () => stopSiren();
  }, []);

  // Listen for real-time acknowledgment from responder
  useEffect(() => {
    if (!dispatchedAlert?._id) return;
    const socket = getSocket();
    joinRoom(`alert:${dispatchedAlert._id}`);

    const handleAcknowledged = (data) => {
      setAcknowledgedData(data);
      stopSiren();
      setSirenPlaying(false);
    };

    socket.on('alert:acknowledged', handleAcknowledged);

    return () => {
      leaveRoom(`alert:${dispatchedAlert._id}`);
      socket.off('alert:acknowledged', handleAcknowledged);
    };
  }, [dispatchedAlert]);

  const toggleSiren = () => {
    if (sirenPlaying) {
      stopSiren();
      setSirenPlaying(false);
    } else {
      startSiren();
      setSirenPlaying(true);
    }
  };

  const executeDispatch = async (bypassGrace = true) => {
    setIsSubmitting(true);
    setError(null);

    // Get freshest coordinates
    let lat = currentLocation?.latitude;
    let lon = currentLocation?.longitude;
    let address = currentLocation?.address || 'Current Location';

    if (!lat) {
      try {
        const saved = localStorage.getItem('safepath_last_coords');
        if (saved) {
          const parsed = JSON.parse(saved);
          lat = parsed.latitude;
          lon = parsed.longitude;
        }
      } catch (e) {}
    }

    const payload = {
      tripId: tripId || null,
      latitude: lat || 9.8743,
      longitude: lon || 77.3747,
      accuracy: currentLocation?.accuracy || 12,
      address,
      explanation: 'Manual Emergency SOS triggered by user.',
      idempotencyKey: `manual-sos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bypassGrace: true // Dispatches immediately to contacts
    };

    try {
      if (!isOnline) {
        await enqueueOfflineEvent('MANUAL_EMERGENCY', payload);
        setDispatchedAlert({
          status: 'QUEUED_OFFLINE',
          message: 'Offline: Emergency alert queued locally and will dispatch the second connection returns.'
        });
      } else {
        const res = await api.post('/alerts/manual', payload);
        if (res.success) {
          setDispatchedAlert(res.alert);
          setAlertMeta(res);
          startSiren();
          setSirenPlaying(true);
          if (onAlertTriggered) onAlertTriggered(res.alert);

          // AUTOMATIC DISPATCH: Automatically launch WhatsApp to the contact's phone!
          if (res.whatsappUrl) {
            try {
              window.open(res.whatsappUrl, '_blank', 'noopener,noreferrer');
            } catch (e) {
              console.warn('WhatsApp auto-launch popup blocked by browser, available via button:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to trigger emergency alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    stopSiren();
    setSirenPlaying(false);

    if (dispatchedAlert && dispatchedAlert._id) {
      try {
        await api.post(`/alerts/${dispatchedAlert._id}/cancel`, {
          reason: 'False alarm cancelled by user.'
        });
      } catch (e) {}
    }
    onClose();
  };

  const handleCopyAlertLink = () => {
    const url = alertMeta?.alertUrl || `${window.location.origin}/respond/${dispatchedAlert?.publicAccessToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleNativeShare = async () => {
    const url = alertMeta?.alertUrl || `${window.location.origin}/respond/${dispatchedAlert?.publicAccessToken}`;
    const text = `🚨 URGENT EMERGENCY ALERT: ${user?.name || 'A SafePath User'} needs immediate assistance! Track live location and acknowledge here:`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: '🚨 SafePath Emergency SOS Alert',
          text,
          url
        });
      } catch (e) {}
    } else {
      handleCopyAlertLink();
    }
  };

  if (!isOpen) return null;

  const responderUrl = alertMeta?.alertUrl || (dispatchedAlert?.publicAccessToken ? `${window.location.origin}/respond/${dispatchedAlert.publicAccessToken}` : null);
  const activeContact = alertMeta?.activeContact || dispatchedAlert?.currentContactId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 max-w-lg w-full shadow-2xl shadow-rose-950/80 text-slate-100 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {!dispatchedAlert ? (
          /* Automatic Dispatching Indicator */
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mx-auto text-rose-500 shadow-xl shadow-rose-500/30 animate-pulse">
              <ShieldAlert className="w-9 h-9 animate-bounce" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-white tracking-tight">EMERGENCY SOS ACTIVATED</h3>
              <p className="text-xs text-rose-300 font-semibold mt-1 max-w-sm mx-auto">
                Automatically dispatching Safety Relay, sending emergency emails, and launching WhatsApp...
              </p>
            </div>

            <div className="py-4 px-6 bg-slate-950/60 rounded-2xl border border-rose-500/40 space-y-2">
              <div className="flex items-center justify-center gap-2 text-rose-400 font-bold text-sm animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                <span>Dispatching to Safety Circle Responders...</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Email and WhatsApp notifications are being triggered automatically.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-300">
                {error}
              </div>
            )}

            <button
              onClick={handleCancel}
              className="py-2.5 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors mx-auto"
            >
              Cancel Alarm (False Alarm)
            </button>
          </div>
        ) : (
          /* STEP 2: Active Emergency Dispatched Command Center */
          <div className="space-y-5">
            {/* Top alert state header */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950 border border-rose-500/50 text-rose-300 text-xs font-bold uppercase tracking-wider animate-pulse mb-2">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Emergency Alert Active
              </div>
              <h3 className="text-xl font-black text-white">Safety Relay Dispatched</h3>
              <p className="text-xs text-slate-300">
                Live location and incident tracking have been activated.
              </p>
            </div>

            {/* Audio Siren Banner */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-rose-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                {sirenPlaying ? (
                  <Volume2 className="w-5 h-5 text-rose-400 animate-bounce" />
                ) : (
                  <VolumeX className="w-5 h-5 text-slate-500" />
                )}
                <div>
                  <p className="font-bold text-white text-xs">
                    {sirenPlaying ? 'Emergency Siren Sounding' : 'Audio Alarm Muted'}
                  </p>
                  <p className="text-[10px] text-slate-400">Audible alarm playing on device speakers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleSiren}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  sirenPlaying
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {sirenPlaying ? 'Mute Alarm' : 'Sound Alarm'}
              </button>
            </div>

            {/* Responder & Acknowledgment Status Card */}
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-700/50 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Primary Responder
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-900/80 text-indigo-200">
                  Priority #1
                </span>
              </div>

              {acknowledgedData ? (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl space-y-1 animate-in zoom-in-95">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>✓ Acknowledged by {acknowledgedData.contactName || 'Responder'}</span>
                  </div>
                  <p className="text-xs text-slate-200 pl-6 italic">
                    "{acknowledgedData.responseNote || 'I am on my way.'}"
                  </p>
                  <p className="text-[10px] text-emerald-400 pl-6">
                    Safety Relay escalation stopped. Responder is actively handling.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">
                      {activeContact?.name || 'Primary Trusted Contact'}
                    </h4>
                    <span className="text-xs text-slate-400">
                      {activeContact?.relationship || 'Contact'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-300 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    Awaiting acknowledgment (Escalates to Priority #2 in 10 mins if no response)
                  </p>
                </div>
              )}
            </div>

            {/* Automatic Real-Time Dispatch Summary */}
            <div className="p-3 bg-emerald-950/60 border border-emerald-600/50 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Automated Alert Dispatch Complete:</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1 pl-6">
                <p className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span><strong>Email Dispatched:</strong> Incident notification sent to <strong>{activeContact?.email || 'Safety Contact'}</strong></span>
                </p>
                {activeContact?.phone && (
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span><strong>WhatsApp Dispatched:</strong> Emergency chat launched for <strong>{activeContact.phone}</strong></span>
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span><strong>Live GPS Tracker:</strong> Live location broadcast active on Safety Relay</span>
                </p>
              </div>
            </div>

            {/* Direct Responder Action Buttons */}
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                Direct Responder Delivery Options:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* 1. Direct WhatsApp Message to Contact */}
                {activeContact?.phone ? (
                  <a
                    href={
                      alertMeta?.whatsappUrl ||
                      `https://api.whatsapp.com/send?phone=${encodeURIComponent(
                        activeContact.phone.replace(/[^0-9+]/g, '')
                      )}&text=${encodeURIComponent(
                        `🚨 URGENT EMERGENCY SOS! I need help. View my live GPS location and acknowledge here: ${responderUrl}`
                      )}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Send via WhatsApp
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Share on WhatsApp
                  </button>
                )}

                {/* 2. Direct Phone Call */}
                {activeContact?.phone ? (
                  <a
                    href={`tel:${activeContact.phone.replace(/\s+/g, '')}`}
                    className="py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-sky-600/30 transition-all active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                    Call {activeContact.phone}
                  </a>
                ) : (
                  <a
                    href="tel:911"
                    className="py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30 transition-all active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                    Call Emergency Services
                  </a>
                )}

                {/* 3. Direct Gmail Compose */}
                {activeContact?.email && (
                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(activeContact.email)}&su=${encodeURIComponent('URGENT: SafePath Emergency SOS Alert')}&body=${encodeURIComponent(`Hello ${activeContact.name},\n\nI have triggered a SafePath Emergency SOS Alert! View my live GPS location and acknowledge here:\n${responderUrl}\n\nThank you!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-700 shadow-md transition-all active:scale-95"
                  >
                    <Mail className="w-4 h-4 text-indigo-400" />
                    Email via Gmail
                  </a>
                )}

                {/* 4. Open Responder Incident Tracker Page directly */}
                {responderUrl && (
                  <a
                    href={responderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Responder View
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyAlertLink}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Incident Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                  title="Broadcast to any app"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/50 text-rose-300 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel Alarm (Safe Now)
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Close Modal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
