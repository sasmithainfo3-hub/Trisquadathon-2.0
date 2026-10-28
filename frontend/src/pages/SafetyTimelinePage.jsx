import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Shield, CheckCircle2, Send, Filter, RefreshCw, MapPin } from 'lucide-react';
import { api } from '../utils/api';

export default function SafetyTimelinePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (severityFilter) params.append('severity', severityFilter);
      if (typeFilter) params.append('eventType', typeFilter);

      const res = await api.get(`/events?${params.toString()}`);
      if (res.success) {
        setEvents(res.events || []);
      }
    } catch (err) {
      console.error('Failed to load safety events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [severityFilter, typeFilter]);

  const getEventIcon = (type, severity) => {
    if (type === 'MANUAL_EMERGENCY' || severity === 'critical') return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    if (type === 'ALERT_ACKNOWLEDGED' || type === 'CHECKIN_COMPLETED') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (type === 'NOTIFICATION_SENT' || type === 'ALERT_ESCALATED') return <Send className="w-4 h-4 text-amber-400" />;
    if (type === 'ALERT_RESOLVED') return <Shield className="w-4 h-4 text-indigo-400" />;
    return <Clock className="w-4 h-4 text-sky-400" />;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Safety Event Timeline</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete chronological audit trail of journey events, check-ins, notifications, and escalations.
          </p>
        </div>

        <button
          onClick={loadEvents}
          className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl self-start sm:self-auto"
          title="Refresh timeline"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Row */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" /> Filters:
        </span>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="info">Info</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
        >
          <option value="">All Event Types</option>
          <option value="TRIP_STARTED">Journey Started</option>
          <option value="CHECKIN_COMPLETED">Check-In Confirmed</option>
          <option value="CHECKIN_MISSED">Check-In Missed</option>
          <option value="MANUAL_EMERGENCY">Manual Emergency SOS</option>
          <option value="NOTIFICATION_SENT">Notification Dispatched</option>
          <option value="ALERT_ESCALATED">Alert Escalated</option>
          <option value="ALERT_ACKNOWLEDGED">Alert Acknowledged</option>
          <option value="ALERT_RESOLVED">Alert Resolved</option>
        </select>
      </div>

      {/* Timeline Stream */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Loading safety history...
        </div>
      ) : events.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl text-xs text-slate-400">
          No events match the selected filters.
        </div>
      ) : (
        <div className="space-y-3 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-800">
          {events.map((event) => (
            <div
              key={event._id}
              className="relative flex items-start gap-4 pl-12 glass-panel p-4 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors"
            >
              {/* Dot Icon */}
              <div
                className={`absolute left-3 top-4 w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950 bg-slate-900`}
              >
                {getEventIcon(event.eventType, event.severity)}
              </div>

              <div className="w-full space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{event.title}</h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                        event.severity === 'critical'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                          : event.severity === 'high'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {event.severity}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(event.createdAt).toLocaleDateString()} at {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-xs text-slate-300">{event.details}</p>

                {event.location?.latitude && (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-600" />
                    {event.location.latitude.toFixed(5)}, {event.location.longitude.toFixed(5)}
                    {event.location.address ? ` (${event.location.address})` : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
