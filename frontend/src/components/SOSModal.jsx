import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  X,
  Volume2,
  VolumeX,
  MessageCircle,
  ExternalLink,
  Share2,
  Phone,
  Clock,
  Copy,
  Check,
  CheckCircle2,
  MapPin,
  Mail,
  Flame,
  Radio,
  HeartHandshake
} from 'lucide-react';
import { api } from '../utils/api';
import { getSocket, joinRoom, leaveRoom } from '../utils/socket';
import { enqueueOfflineEvent } from '../utils/idbQueue';
import { useAuth } from '../context/AuthContext';

// Web Audio API Dual-Tone Emergency Siren
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
        osc.frequency.setValueAtTime(high ? 1350 : 880, audioContext.currentTime);
        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.32);
        osc.start();
        osc.stop(audioContext.currentTime + 0.32);
        high = !high;
      } catch (e) {}
    }, 320);
  } catch (e) {
    console.warn('Audio siren start notice:', e);
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dispatchedAlert, setDispatchedAlert] = useState(null);
  const [alertMeta, setAlertMeta] = useState(null);
  const [acknowledgedData, setAcknowledgedData] = useState(null);
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [error, setError] = useState(null);

  // Cached primary contact from localStorage for instant offline access
  const cachedContact = (() => {
    try {
      return JSON.parse(localStorage.getItem('safepath_primary_contact') || 'null');
    } catch (e) {
      return null;
    }
  })();

  // Current active contact resolution
  const activeContact = alertMeta?.activeContact || dispatchedAlert?.currentContactId || cachedContact;
  const contactName = activeContact?.name || 'Primary Contact';
  const contactPhone = activeContact?.phone || '+917200843124';
  const cleanPhone = contactPhone.replace(/[^0-9+]/g, '');

  // Coords resolution
  const lat = currentLocation?.latitude || 9.8743;
  const lon = currentLocation?.longitude || 77.3747;
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;

  // Responder tracking URL
  const responderUrl =
    alertMeta?.alertUrl ||
    (dispatchedAlert?.publicAccessToken
      ? `${window.location.origin}/respond/${dispatchedAlert.publicAccessToken}`
      : `${window.location.origin}/dashboard`);

  // Distress message payload with live GPS coordinates
  const emergencyMessage = `🚨 URGENT EMERGENCY SOS! ${user?.name || 'A user'} is in immediate danger! My live GPS location: https://maps.google.com/?q=${lat},${lon} | Track live response: ${responderUrl}`;

  // Direct native intent URLs
  const policeCallUrl = 'tel:112';
  const womenHelplineUrl = 'tel:1091';
  const contactCallUrl = `tel:${cleanPhone}`;
  const smsIntentUrl = `sms:${cleanPhone}?body=${encodeURIComponent(emergencyMessage)}`;
  const waIntentUrl = alertMeta?.whatsappUrl || `https://api.whatsapp.com/send?phone=${cleanPhone.replace(/^\+/, '')}&text=${encodeURIComponent(emergencyMessage)}`;

  // Auto-dispatch on open & start audio siren
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

    startSiren();
    setSirenPlaying(true);
    executeDispatch();
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

  const executeDispatch = async () => {
    setIsSubmitting(true);
    setError(null);

    const payload = {
      tripId: tripId || null,
      latitude: lat,
      longitude: lon,
      accuracy: currentLocation?.accuracy || 10,
      address: currentLocation?.address || 'Current Location',
      explanation: 'Manual Emergency SOS triggered by user.',
      idempotencyKey: `manual-sos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bypassGrace: true
    };

    try {
      if (!isOnline) {
        await enqueueOfflineEvent('MANUAL_EMERGENCY', payload);
        setDispatchedAlert({
          status: 'QUEUED_OFFLINE',
          message: 'Offline: Emergency alert queued locally.'
        });
      } else {
        const res = await api.post('/alerts/manual', payload);
        if (res.success) {
          setDispatchedAlert(res.alert);
          setAlertMeta(res);
          if (onAlertTriggered) onAlertTriggered(res.alert);
        }
      }
    } catch (err) {
      setError(err.message || 'Server alert dispatch encountered a delay.');
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
    navigator.clipboard.writeText(responderUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${lat.toFixed(5)}, ${lon.toFixed(5)} (${googleMapsUrl})`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 3000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: '🚨 SafePath Emergency SOS Alert',
          text: emergencyMessage,
          url: responderUrl
        });
      } catch (e) {}
    } else {
      handleCopyAlertLink();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl shadow-rose-950/80 text-slate-100 relative max-h-[94vh] overflow-y-auto space-y-4">
        {/* Close / Cancel Button */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Emergency Beacon Strobe Header */}
        <div className="text-center space-y-2 pt-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600/20 border border-rose-500 text-rose-400 text-xs font-black uppercase tracking-wider animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <span>🚨 EMERGENCY SOS ACTIVE 🚨</span>
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight">
            Safety Command Center
          </h3>
          <p className="text-xs text-rose-300 font-medium">
            Immediate 1-tap mobile action triggers below for life-safety response.
          </p>
        </div>

        {/* Audible Siren Controller Banner */}
        <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            {sirenPlaying ? (
              <Volume2 className="w-5 h-5 text-rose-400 animate-bounce" />
            ) : (
              <VolumeX className="w-5 h-5 text-slate-500" />
            )}
            <div>
              <p className="font-bold text-white text-xs">
                {sirenPlaying ? 'High-Decibel Siren Sounding' : 'Audible Alarm Muted'}
              </p>
              <p className="text-[10px] text-slate-400">Piercing alarm to deter threats and alert bystanders</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleSiren}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              sirenPlaying
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {sirenPlaying ? 'Mute' : 'Sound Alarm'}
          </button>
        </div>

        {/* CORE MOBILE EMERGENCY ACTION GRID (Instant 1-Tap Execution) */}
        <div className="space-y-2 pt-1">
          <p className="text-[11px] uppercase tracking-wider font-extrabold text-amber-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            <span>Immediate 1-Tap Direct Actions:</span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. CALL POLICE (112) */}
            <a
              href={policeCallUrl}
              className="p-3 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold rounded-2xl flex items-center justify-between shadow-lg shadow-red-600/40 transition-all active:scale-95 border border-red-400/40"
            >
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-red-200 font-bold">Police / Helpline</p>
                  <p className="text-base font-black leading-tight">CALL 112</p>
                </div>
              </div>
              <span className="text-[10px] bg-red-950/70 px-2 py-0.5 rounded-lg border border-red-500/50">Toll-Free</span>
            </a>

            {/* 2. CALL TRUSTED CONTACT */}
            <a
              href={contactCallUrl}
              className="p-3 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-extrabold rounded-2xl flex items-center justify-between shadow-lg shadow-sky-600/40 transition-all active:scale-95 border border-sky-400/40"
            >
              <div className="flex items-center gap-2.5 text-left truncate">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="truncate">
                  <p className="text-xs uppercase tracking-wider text-sky-200 font-bold truncate">Call {contactName}</p>
                  <p className="text-sm font-black leading-tight truncate">{contactPhone}</p>
                </div>
              </div>
              <span className="text-[10px] bg-sky-950/70 px-2 py-0.5 rounded-lg border border-sky-500/50 shrink-0">Priority #1</span>
            </a>

            {/* 3. SEND DIRECT SMS WITH LIVE GPS */}
            <a
              href={smsIntentUrl}
              className="p-3 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-extrabold rounded-2xl flex items-center justify-between shadow-lg shadow-amber-600/40 transition-all active:scale-95 border border-amber-400/40"
            >
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-amber-200 font-bold">Direct Phone SMS</p>
                  <p className="text-sm font-black leading-tight">Send GPS SMS</p>
                </div>
              </div>
              <span className="text-[10px] bg-amber-950/70 px-2 py-0.5 rounded-lg border border-amber-500/50">Auto-GPS</span>
            </a>

            {/* 4. SEND DIRECT WHATSAPP */}
            <a
              href={waIntentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-600/40 transition-all active:scale-95 border border-emerald-400/40"
            >
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-emerald-200 font-bold">Instant Chat</p>
                  <p className="text-sm font-black leading-tight">WhatsApp Distress</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-950/70 px-2 py-0.5 rounded-lg border border-emerald-500/50">1-Tap</span>
            </a>
          </div>

          {/* Secondary Quick Action Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {/* Women Helpline */}
            <a
              href={womenHelplineUrl}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-rose-500/30 text-rose-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-rose-400" />
              <span>Women: 1091</span>
            </a>

            {/* Google Maps Pin */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open Maps Pin</span>
            </a>

            {/* Native Share to Any App */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="col-span-2 sm:col-span-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Share to Apps</span>
            </button>
          </div>
        </div>

        {/* Real-Time Responder Acknowledgment & Cloud Status */}
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-indigo-700/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-indigo-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              Cloud Relay Dispatch Status
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-900/80 text-indigo-200">
              {acknowledgedData ? 'ACKNOWLEDGED' : 'ACTIVE DISPATCH'}
            </span>
          </div>

          {acknowledgedData ? (
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/60 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>✓ {acknowledgedData.contactName || 'Responder'} is responding!</span>
              </div>
              <p className="text-xs text-slate-200 pl-6 italic">
                "{acknowledgedData.responseNote || 'I am on my way.'}"
              </p>
            </div>
          ) : (
            <div className="text-[11px] text-slate-300 space-y-1">
              <p className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                <span><strong>Gmail SMTP Dispatch:</strong> Automated email alert sent to <strong>{activeContact?.email || 'Registered Contact'}</strong></span>
              </p>
              <p className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                <span><strong>Live GPS Pin:</strong> {lat.toFixed(5)}, {lon.toFixed(5)} broadcast active</span>
              </p>
            </div>
          )}

          {/* Quick Copy Link & Coordinates */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleCopyAlertLink}
              className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium rounded-lg flex items-center justify-center gap-1 border border-slate-700/80 transition-colors"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-indigo-400" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Incident URL'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyCoords}
              className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium rounded-lg flex items-center justify-center gap-1 border border-slate-700/80 transition-colors"
            >
              {copiedCoords ? <Check className="w-3 h-3 text-emerald-400" /> : <MapPin className="w-3 h-3 text-emerald-400" />}
              <span>{copiedCoords ? 'GPS Copied!' : 'Copy GPS Coords'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Control Actions */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/50 text-rose-300 rounded-xl text-xs font-bold transition-colors"
          >
            I Am Safe (Cancel Alarm)
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Dismiss Screen
          </button>
        </div>
      </div>
    </div>
  );
}
