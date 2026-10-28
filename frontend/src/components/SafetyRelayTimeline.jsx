import React from 'react';
import { Shield, Clock, Send, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export default function SafetyRelayTimeline({ status = 'MONITORING', activeContactName = null, escalationLevel = 1 }) {
  const steps = [
    {
      id: 'MONITORING',
      name: 'Journey Monitoring',
      desc: 'GPS & Check-in Cadence',
      icon: Clock,
      isActive: ['MONITORING', 'CREATED', 'DISPATCHING', 'NOTIFIED', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)
    },
    {
      id: 'CONCERN',
      name: 'Safety Concern',
      desc: 'Missed Check-in or SOS',
      icon: AlertTriangle,
      isActive: ['CREATED', 'DISPATCHING', 'NOTIFIED', 'ACKNOWLEDGED', 'RESOLVED'].includes(status) && status !== 'MONITORING'
    },
    {
      id: 'DELIVERY',
      name: 'Alert Delivery',
      desc: activeContactName ? `Dispatched to ${activeContactName}` : 'Multi-channel Dispatch',
      icon: Send,
      isActive: ['DISPATCHING', 'NOTIFIED', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)
    },
    {
      id: 'ACKNOWLEDGED',
      name: 'Contact Acknowledgment',
      desc: escalationLevel > 1 ? `Escalated Level ${escalationLevel}` : 'Contact Confirmed Response',
      icon: CheckCircle2,
      isActive: ['ACKNOWLEDGED', 'RESOLVED'].includes(status)
    },
    {
      id: 'RESOLVED',
      name: 'Safe Resolution',
      desc: 'Safe Arrival Confirmed',
      icon: Shield,
      isActive: status === 'RESOLVED'
    }
  ];

  return (
    <div className="w-full bg-slate-900/60 rounded-xl p-4 sm:p-5 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          Safety Relay Lifecycle
        </h4>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
          State: {status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isCurrent = (
            (status === 'MONITORING' && step.id === 'MONITORING') ||
            (status === 'CREATED' && step.id === 'CONCERN') ||
            (['DISPATCHING', 'NOTIFIED'].includes(status) && step.id === 'DELIVERY') ||
            (status === 'ACKNOWLEDGED' && step.id === 'ACKNOWLEDGED') ||
            (status === 'RESOLVED' && step.id === 'RESOLVED')
          );

          return (
            <div
              key={step.id}
              className={`relative flex sm:flex-col items-center sm:items-start p-3 rounded-lg border transition-all ${
                isCurrent
                  ? 'bg-indigo-950/60 border-indigo-500/60 shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-500/30'
                  : step.isActive
                  ? 'bg-slate-800/40 border-slate-700/50 text-slate-300'
                  : 'bg-slate-900/30 border-slate-800/40 opacity-40 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isCurrent
                      ? 'bg-indigo-500 text-white animate-pulse'
                      : step.isActive
                      ? 'bg-slate-700 text-indigo-300'
                      : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-white truncate">{step.name}</span>
              </div>
              <p className="text-[11px] text-slate-400 pl-8 sm:pl-0 truncate w-full">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
