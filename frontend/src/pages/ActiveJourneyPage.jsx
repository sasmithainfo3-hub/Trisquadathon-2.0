import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Clock, CheckCircle2, ShieldAlert, AlertTriangle, Navigation, MapPin, RefreshCw, PlusCircle, ArrowLeft, BellRing, Volume2, VolumeX } from 'lucide-react';
import { api } from '../utils/api';
import { getSocket, joinRoom, leaveRoom } from '../utils/socket';
import { enqueueOfflineEvent } from '../utils/idbQueue';
import { useAuth } from '../context/AuthContext';
import LocationMap from '../components/LocationMap';
import SOSModal from '../components/SOSModal';
import HoldToTriggerButton from '../components/HoldToTriggerButton';
import SafetyRelayTimeline from '../components/SafetyRelayTimeline';
import {
  triggerUnsilentReminder,
  requestScreenWakeLock,
  releaseScreenWakeLock,
  isBreakthroughEnabled,
  setBreakthroughEnabled,
  playBreakthroughChime,
  triggerBreakthroughHaptics
} from '../utils/silentBreakthrough';

export default function ActiveJourneyPage() {
  const navigate = useNavigate();
  const { isOnline } = useAuth();

  const [trip, setTrip] = useState(null);
  const [nextCheckIn, setNextCheckIn] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [lastLocationUpdateTime, setLastLocationUpdateTime] = useState(new Date());
  const [unsilentEnabled, setUnsilentEnabled] = useState(isBreakthroughEnabled());

  const watchIdRef = useRef(null);
  const lastAlertTimeRef = useRef(0);

  // Keep screen awake during journey & request notification permission
  useEffect(() => {
    requestScreenWakeLock();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    return () => {
      releaseScreenWakeLock();
    };
  }, []);

  // Fetch active trip
  useEffect(() => {
    async function loadActiveTrip() {
      try {
        const res = await api.get('/trips?status=active&limit=1');
        if (res.success && res.trips?.length > 0) {
          const active = res.trips[0];
          setTrip(active);
          setCurrentLocation(active.currentLocation || active.startLocation);

          // Fetch next check-in
          const tripDetail = await api.get(`/trips/${active._id}`);
          if (tripDetail.success) {
            setNextCheckIn(tripDetail.nextCheckIn);
          }
        } else {
          setTrip(null);
        }
      } catch (err) {
        console.error('Failed to load active trip:', err);
      } finally {
        setLoading(false);
      }
    }

    loadActiveTrip();
  }, []);

  // Listen to Socket.IO real-time events
  useEffect(() => {
    if (!trip) return;
    const socket = getSocket();
    joinRoom(`trip:${trip._id}`);

    const handleCheckInCompleted = (data) => {
      setNextCheckIn(data.nextCheckIn);
      setSuccessMessage('Check-in confirmed safe!');
      setTimeout(() => setSuccessMessage(null), 4000);
    };

    const handleLocationUpdated = (data) => {
      setCurrentLocation(data.currentLocation);
      setLastLocationUpdateTime(new Date());
    };

    const handleTripEscalated = () => {
      setTrip((prev) => (prev ? { ...prev, status: 'escalated' } : prev));
    };

    socket.on('checkin:completed', handleCheckInCompleted);
    socket.on('trip:location_updated', handleLocationUpdated);
    socket.on('trip:escalated', handleTripEscalated);

    return () => {
      leaveRoom(`trip:${trip._id}`);
      socket.off('checkin:completed', handleCheckInCompleted);
      socket.off('trip:location_updated', handleLocationUpdated);
      socket.off('trip:escalated', handleTripEscalated);
    };
  }, [trip]);

  // Browser Geolocation Live Tracking
  useEffect(() => {
    if (!trip || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const point = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: new Date()
        };
        setCurrentLocation(point);
        setLastLocationUpdateTime(new Date());

        // Ping backend if online, else queue in IndexedDB
        if (isOnline) {
          try {
            await api.post(`/trips/${trip._id}/location`, point);
          } catch (e) {
            // ignore ping errors
          }
        } else {
          await enqueueOfflineEvent('LOCATION_PING', { tripId: trip._id, ...point });
        }
      },
      (err) => console.warn('Geolocation watch error:', err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [trip, isOnline]);

  // Countdown timer for next check-in
  useEffect(() => {
    if (!nextCheckIn?.dueAt) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const due = new Date(nextCheckIn.dueAt).getTime();
      const diffSecs = Math.max(0, Math.floor((due - now) / 1000));
      setSecondsRemaining(diffSecs);
    }, 1000);

    return () => clearInterval(interval);
  }, [nextCheckIn]);

  // Breakthrough Unsilent Reminder when Check-In is due / grace active
  useEffect(() => {
    if (!nextCheckIn?.dueAt || !unsilentEnabled) return;
    const now = Date.now();
    const isDue = new Date(nextCheckIn.dueAt).getTime() <= now;

    if (isDue) {
      // Throttle reminder alerts so they sound every 30 seconds while check-in is pending/grace active
      if (now - lastAlertTimeRef.current > 30000) {
        lastAlertTimeRef.current = now;
        triggerUnsilentReminder({
          title: '⏰ SafePath Check-In Due!',
          body: 'Your scheduled journey check-in is due now. Tap to confirm you are safe.',
          type: 'warning'
        });
      }
    }
  }, [secondsRemaining, nextCheckIn, unsilentEnabled]);

  // Manual Check-In action
  const handleAcknowledgeCheckIn = async () => {
    if (!nextCheckIn) return;
    setCheckInLoading(true);

    const payload = {
      checkInId: nextCheckIn._id,
      latitude: currentLocation?.latitude || 0,
      longitude: currentLocation?.longitude || 0,
      accuracy: currentLocation?.accuracy || null,
      note: 'I am safe and on track.'
    };

    try {
      if (!isOnline) {
        // Queue in IndexedDB
        await enqueueOfflineEvent('CHECKIN', payload);
        setSuccessMessage('Offline: Check-in saved locally and will sync once connected.');
      } else {
        const res = await api.post(`/check-ins/${nextCheckIn._id}/acknowledge`, payload);
        if (res.success) {
          setNextCheckIn(res.nextCheckIn);
          setSuccessMessage('Check-in confirmed safe!');
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to confirm check-in');
    } finally {
      setCheckInLoading(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Safe Arrival
  const handleCompleteTrip = async () => {
    if (!window.confirm('Confirm safe arrival at destination? This will conclude active journey monitoring.')) {
      return;
    }

    try {
      await api.post(`/trips/${trip._id}/complete`);
      navigate('/dashboard');
    } catch (err) {
      alert(err.message || 'Failed to complete trip');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <Navigation className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">No Active Journey Right Now</h2>
        <p className="text-xs text-slate-400">You are not currently monitoring any trips.</p>
        <Link
          to="/plan"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs"
        >
          Plan New Journey
        </Link>
      </div>
    );
  }

  const formatCountdown = (secs) => {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isGraceActive = nextCheckIn && new Date() > new Date(nextCheckIn.dueAt);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Active Safe Journey
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">{trip.title}</h1>
          <p className="text-xs text-slate-400">
            Destination: <strong>{trip.destination.address}</strong>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <HoldToTriggerButton
            size="default"
            label="HOLD FOR SOS"
            sublabel="Press 1.5s"
            onTrigger={() => setSosModalOpen(true)}
          />
          <button
            onClick={handleCompleteTrip}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> I've Arrived Safely
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {successMessage}
        </div>
      )}

      {/* Main Grid: Check-In Card & Live Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Check-In Countdown & Actions */}
        <div className="lg:col-span-5 space-y-5">
          {/* Check-In Card */}
          <div
            className={`glass-panel p-6 rounded-2xl border transition-all ${
              isGraceActive
                ? 'bg-amber-950/40 border-amber-500 shadow-xl shadow-amber-950/50'
                : 'border-indigo-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" />
                {isGraceActive ? 'Grace Period Active!' : 'Next Safety Check-In'}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isGraceActive
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-indigo-950 text-indigo-300 border border-indigo-800/40'
                }`}
              >
                {isGraceActive ? 'CONFIRM NOW' : 'PENDING'}
              </span>
            </div>

            {/* Countdown Display */}
            <div className="py-4 text-center">
              <div
                className={`text-5xl font-black tracking-tight ${
                  isGraceActive ? 'text-amber-400 animate-pulse' : 'text-white'
                }`}
              >
                {formatCountdown(secondsRemaining)}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {isGraceActive
                  ? 'Your scheduled check-in was reached. Please tap below to confirm you are safe.'
                  : `Due at ${nextCheckIn ? new Date(nextCheckIn.dueAt).toLocaleTimeString() : '...'}`}
              </p>
            </div>

            {/* Big "I Am Safe" Button */}
            <button
              onClick={handleAcknowledgeCheckIn}
              disabled={checkInLoading || !nextCheckIn}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm transition-all hover:scale-[1.01]"
            >
              <CheckCircle2 className="w-5 h-5" />
              {checkInLoading ? 'Confirming...' : "I'm Safe (Confirm Check-In)"}
            </button>
          </div>

          {/* Unsilent Breakthrough Reminder Control */}
          <div className="glass-panel p-4 rounded-xl border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${unsilentEnabled ? 'bg-indigo-600/30 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                  {unsilentEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Unsilent Reminder Mode
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                      MEDIA CHANNEL
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Bypasses silent switch to sound due check-ins
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={unsilentEnabled}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setUnsilentEnabled(val);
                    setBreakthroughEnabled(val);
                    if (val) {
                      triggerUnsilentReminder({
                        title: '🔊 Unsilent Mode Active',
                        body: 'SafePath check-in alerts will play through media speaker even if phone is muted.',
                        type: 'checkin'
                      });
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Test reminder chime & vibration:</span>
              <button
                type="button"
                onClick={() => {
                  triggerUnsilentReminder({
                    title: '🔔 SafePath Test Chime',
                    body: 'This chime plays on the media channel to bypass your phone silent switch.',
                    type: 'warning'
                  });
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 hover:border-indigo-500/50"
              >
                <BellRing className="w-3 h-3 text-amber-400" /> Test Chime
              </button>
            </div>
          </div>

          {/* GPS Freshness & Accuracy Telemetry */}
          <div className="glass-panel p-4 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" /> GPS Telemetry
              </span>
              <span className="text-emerald-400 font-semibold">
                Accuracy: ±{Math.round(currentLocation?.accuracy || 8)}m
              </span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Last ping: {lastLocationUpdateTime.toLocaleTimeString()} • Coordinates:{' '}
              {currentLocation?.latitude ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}` : 'Detecting...'}
            </p>
            <p className="text-[10px] text-slate-500">
              Ephemeral location is streamed exclusively to your authorized active journey session.
            </p>
          </div>
        </div>

        {/* Right Column: Live Map */}
        <div className="lg:col-span-7 glass-panel p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Live Journey Map
            </span>
            <span className="text-[11px] text-slate-400">
              Mode: <strong className="text-white capitalize">{trip.travelMode}</strong>
            </span>
          </div>

          <LocationMap
            currentLocation={currentLocation}
            startLocation={trip.startLocation}
            destination={trip.destination}
            routeCoordinates={trip.routeCoordinates}
            height="460px"
          />
        </div>
      </div>

      {/* Safety Relay Lifecycle State */}
      <SafetyRelayTimeline status={trip.status === 'escalated' ? 'DELIVERY' : 'MONITORING'} />

      {/* SOS Modal */}
      <SOSModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        tripId={trip._id}
        currentLocation={currentLocation}
        onAlertTriggered={() => setSosModalOpen(false)}
      />
    </div>
  );
}
