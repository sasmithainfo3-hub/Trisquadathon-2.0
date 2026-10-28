import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Navigation, AlertTriangle, Users, Clock, ArrowRight, ShieldAlert, CheckCircle2, ChevronRight, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import SOSModal from '../components/SOSModal';
import SafetyRelayTimeline from '../components/SafetyRelayTimeline';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTrip, setActiveTrip] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sosModalOpen, setSosModalOpen] = useState(false);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [activeTripRes, activeAlertRes, contactsRes, tripsRes] = await Promise.all([
          api.get('/trips?status=active&limit=1'),
          api.get('/alerts/active'),
          api.get('/contacts'),
          api.get('/trips?limit=5')
        ]);

        if (activeTripRes.success && activeTripRes.trips?.length > 0) {
          setActiveTrip(activeTripRes.trips[0]);
        } else {
          setActiveTrip(null);
        }

        if (activeAlertRes.success) {
          setActiveAlert(activeAlertRes.alert);
        }

        if (contactsRes.success) {
          setContacts(contactsRes.contacts || []);
        }

        if (tripsRes.success) {
          setRecentTrips(tripsRes.trips || []);
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const verifiedContacts = contacts.filter((c) => c.status === 'verified');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Hello, {user?.name || 'Friend'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {activeAlert
              ? '⚠️ Immediate safety alert in progress.'
              : activeTrip
              ? 'Monitoring active journey in real time.'
              : 'You are currently safe and idle. Safety circle stands ready.'}
          </p>
        </div>

        {/* Big Quick SOS Trigger Button */}
        <button
          onClick={() => setSosModalOpen(true)}
          className="self-start sm:self-auto px-6 py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold rounded-2xl shadow-xl shadow-rose-950/60 border border-rose-400/40 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 text-sm"
        >
          <ShieldAlert className="w-5 h-5 text-white animate-pulse" />
          EMERGENCY SOS
        </button>
      </div>

      {/* Active Alert Banner (If in emergency) */}
      {activeAlert && (
        <div className="bg-rose-950/70 border-2 border-rose-500 rounded-2xl p-6 shadow-2xl shadow-rose-950/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center animate-ping-slow">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  Active Emergency Alert ({activeAlert.status})
                </h3>
                <p className="text-xs text-rose-200">
                  {activeAlert.triggerExplanation}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/respond/${activeAlert.publicAccessToken}`}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
              >
                View Incident Tracker
              </Link>
            </div>
          </div>

          <SafetyRelayTimeline
            status={activeAlert.status}
            activeContactName={activeAlert.currentContactId?.name || 'Priority Contact'}
            escalationLevel={activeAlert.escalationLevel || 1}
          />
        </div>
      )}

      {/* Active Trip Card */}
      {activeTrip && !activeAlert && (
        <div className="glass-panel p-6 rounded-2xl border-indigo-500/40 relative overflow-hidden space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Active Journey in Progress
              </span>
            </div>

            <Link
              to="/active"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
            >
              Open Live Monitor <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400">Trip Name</p>
              <h4 className="text-lg font-bold text-white mt-0.5">{activeTrip.title}</h4>
            </div>

            <div>
              <p className="text-xs text-slate-400">Destination</p>
              <p className="text-sm font-semibold text-slate-200 mt-0.5 truncate">
                {activeTrip.destination.address}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Check-in Cadence</p>
              <p className="text-sm font-semibold text-slate-200 mt-0.5">
                Every {activeTrip.checkInIntervalMinutes} minutes
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/active"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/30"
            >
              Open Active Journey View & Check In
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Quick Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan Journey Card */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Plan a New Journey</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Set your departure point, destination, travel mode, and safety check-in frequency before heading out.
            </p>
          </div>
          <Link
            to="/plan"
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl text-center flex items-center justify-center gap-2"
          >
            Open Journey Planner <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Safety Circle Card */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Trusted Safety Circle</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                {contacts.length} {contacts.length === 1 ? 'Contact' : 'Contacts'}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {contacts.length === 0
                ? 'No trusted contacts added yet. Add contacts to your Safety Circle to enable the emergency relay.'
                : `${contacts.length} responder(s) standing by in priority order. All contacts are alerted immediately on SOS.`}
            </p>
          </div>
          <Link
            to="/contacts"
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl text-center flex items-center justify-center gap-2"
          >
            Manage Contacts <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Safety Timeline & Audit */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600/20 text-sky-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Safety Event Timeline</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Audit logs for journey starts, completed check-ins, notifications dispatched, and escalations.
            </p>
          </div>
          <Link
            to="/timeline"
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl text-center flex items-center justify-center gap-2"
          >
            View Event History <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Recent Journeys Table */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Recent Journeys</h3>
          <Link to="/plan" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
            + Plan New
          </Link>
        </div>

        {recentTrips.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No journeys recorded yet. Tap "Plan a New Journey" to set up your first route.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentTrips.map((trip) => (
              <div key={trip._id} className="py-3 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">{trip.title}</p>
                  <p className="text-xs text-slate-400">
                    To: {trip.destination.address} • {new Date(trip.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      trip.status === 'completed'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                        : trip.status === 'active'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/40 animate-pulse'
                        : trip.status === 'escalated'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {trip.status}
                  </span>
                  {trip.status === 'active' && (
                    <Link
                      to="/active"
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                    >
                      View
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SOS Modal */}
      <SOSModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        tripId={activeTrip?._id}
        currentLocation={activeTrip?.currentLocation}
        onAlertTriggered={(alert) => {
          setActiveAlert(alert);
          setSosModalOpen(false);
        }}
      />
    </div>
  );
}
