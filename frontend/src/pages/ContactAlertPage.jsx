import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, AlertTriangle, CheckCircle2, Phone, MapPin, Clock, MessageSquare, Send, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import { getSocket, joinRoom, leaveRoom } from '../utils/socket';
import LocationMap from '../components/LocationMap';
import SafetyRelayTimeline from '../components/SafetyRelayTimeline';

export default function ContactAlertPage() {
  const { publicAccessToken } = useParams();

  const [alert, setAlert] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contactName, setContactName] = useState('');
  const [responseNote, setResponseNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState(null);

  const loadAlertData = async () => {
    try {
      const res = await api.get(`/alerts/token/${publicAccessToken}`);
      if (res.success) {
        setAlert(res.alert);
        setActions(res.actions || []);
      } else {
        setError('Alert link is invalid or expired.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load safety incident details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlertData();
  }, [publicAccessToken]);

  // Real-time socket updates for this alert room
  useEffect(() => {
    if (!alert) return;
    const socket = getSocket();
    joinRoom(`alert:${alert._id}`);

    const handleAcknowledged = (data) => {
      setAlert((prev) => (prev ? {
        ...prev,
        status: 'ACKNOWLEDGED',
        acknowledgedContactName: data.contactName,
        responseNote: data.responseNote,
        acknowledgedAt: data.acknowledgedAt
      } : prev));
      setSuccessBanner(`Acknowledged by ${data.contactName}: "${data.responseNote}"`);
    };

    const handleResolved = () => {
      setAlert((prev) => (prev ? { ...prev, status: 'RESOLVED' } : prev));
    };

    socket.on('alert:acknowledged', handleAcknowledged);
    socket.on('alert:resolved', handleResolved);

    return () => {
      leaveRoom(`alert:${alert._id}`);
      socket.off('alert:acknowledged', handleAcknowledged);
      socket.off('alert:resolved', handleResolved);
    };
  }, [alert]);

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post(`/alerts/token/${publicAccessToken}/acknowledge`, {
        contactName: contactName || alert.currentContactId?.name || 'Trusted Contact',
        responseNote: responseNote || 'Confirmed. I am responding to this alert.'
      });

      if (res.success) {
        setAlert(res.alert);
        setSuccessBanner('Your acknowledgment has been recorded! SafePath will not escalate further.');
      }
    } catch (err) {
      setError(err.message || 'Failed to record acknowledgment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Incident Link Unavailable</h2>
        <p className="text-xs text-slate-400">{error || 'This safety incident is no longer active.'}</p>
        <Link to="/" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold block">
          Return to SafePath Home
        </Link>
      </div>
    );
  }

  const isAcknowledged = alert.status === 'ACKNOWLEDGED';
  const isResolved = alert.status === 'RESOLVED';
  const isCancelled = alert.status === 'CANCELLED';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Alert Banner */}
      <div
        className={`p-6 rounded-2xl border space-y-3 ${
          isResolved
            ? 'bg-emerald-950/40 border-emerald-500/40'
            : isCancelled
            ? 'bg-slate-900 border-slate-700'
            : isAcknowledged
            ? 'bg-indigo-950/40 border-indigo-500/40'
            : 'bg-rose-950/60 border-rose-500 shadow-xl shadow-rose-950/50 animate-in fade-in'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${
              isResolved
                ? 'bg-emerald-600'
                : isCancelled
                ? 'bg-slate-700'
                : isAcknowledged
                ? 'bg-indigo-600'
                : 'bg-rose-600 animate-pulse'
            }`}
          >
            {isResolved ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : isAcknowledged ? (
              <Shield className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-rose-400">
                SafePath Safety Incident
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-700">
                Status: {alert.status}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-0.5">
              Safety Alert for {alert.userId?.name || 'SafePath User'}
            </h1>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed pl-13">
          <strong>Reason:</strong> {alert.triggerExplanation}
        </p>

        {alert.aiIncidentSummary && (
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300">
            <strong>Factual Incident Summary:</strong> {alert.aiIncidentSummary}
          </div>
        )}
      </div>

      {successBanner && (
        <div className="p-3 bg-emerald-950 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {successBanner}
        </div>
      )}

      {/* Safety Relay State Machine Progress */}
      <SafetyRelayTimeline
        status={alert.status}
        activeContactName={alert.acknowledgedContactName || alert.currentContactId?.name}
        escalationLevel={alert.escalationLevel}
      />

      {/* Big Action: Acknowledge & Respond */}
      {!isAcknowledged && !isResolved && !isCancelled && (
        <div className="glass-panel p-6 rounded-2xl border border-indigo-500/50 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              Confirm Your Acknowledgment
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Confirming acknowledgment lets {alert.userId?.name} know you are aware and responding. It stops automatic escalation to other contacts.
            </p>
          </div>

          <form onSubmit={handleAcknowledge} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Your Name</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={alert.currentContactId?.name || 'e.g. Elena'}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Response Action Note (Visible to User)
              </label>
              <input
                type="text"
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                placeholder="e.g. Called her phone, driving to last reported coordinates"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm transition-all"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Recording Acknowledgment...' : 'I Acknowledge & Am Responding'}
            </button>
          </form>
        </div>
      )}

      {/* Already Acknowledged Info Box */}
      {isAcknowledged && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-1 text-xs text-emerald-200">
          <p className="font-bold">
            ✓ Acknowledged by {alert.acknowledgedContactName || 'Trusted Contact'} at {new Date(alert.acknowledgedAt).toLocaleTimeString()}
          </p>
          <p className="text-slate-300">
            Note: "{alert.responseNote || 'Contact confirmed they are responding.'}"
          </p>
        </div>
      )}

      {/* Live Map with Last Reported Coordinates */}
      <div className="glass-panel p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-rose-400" /> Last Known Reported Location
          </span>
          <span className="text-xs text-slate-400">
            Recorded at {new Date(alert.lastKnownLocation.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <LocationMap
          currentLocation={alert.lastKnownLocation}
          destination={alert.tripId?.destination}
          height="400px"
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl text-xs text-slate-300">
          <div>
            <p>
              <strong>Coordinates:</strong> {alert.lastKnownLocation.latitude.toFixed(5)}, {alert.lastKnownLocation.longitude.toFixed(5)}
            </p>
            {alert.tripId?.destination && (
              <p>
                <strong>Destination:</strong> {alert.tripId.destination.address}
              </p>
            )}
          </div>

          {alert.userId?.phone && (
            <a
              href={`tel:${alert.userId.phone}`}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs self-stretch sm:self-auto justify-center"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              Call {alert.userId.name} ({alert.userId.phone})
            </a>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-center text-xs text-slate-500 pt-4">
        SafePath is an automated alerting relay and does not replace emergency 911 dispatch.
      </div>
    </div>
  );
}
