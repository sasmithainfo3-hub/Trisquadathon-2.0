import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Clock, Send, CheckCircle2, AlertTriangle, ArrowRight, MapPin, Users, Smartphone, Lock, EyeOff } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-20">
          <div className="w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-indigo-600 via-rose-500 to-sky-400 blur-3xl"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs font-semibold backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Persistent Safety Relay Technology
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            Journey with confidence.<br />
            <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-rose-400 bg-clip-text text-transparent">
              Never travel alone.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            SafePath monitors your trips, tracks scheduled safety check-ins, and initiates a multi-stage escalation relay to trusted contacts the moment a concern occurs.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-base transition-all hover:scale-[1.02]"
            >
              Start Monitoring Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700/60 text-base transition-colors"
            >
              Sign In to Dashboard
            </Link>
          </div>

          <p className="text-xs text-slate-400">
            Free forever for personal safety • No intrusive permanent tracking • Privacy by design
          </p>
        </div>
      </section>

      {/* The Core Differentiator: The Safety Relay Flow */}
      <section id="safety-relay" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-xs uppercase tracking-widest font-extrabold text-indigo-400">
            The Core Differentiator
          </h2>
          <h3 className="text-3xl font-extrabold text-white">
            The SafePath Safety Relay State Machine
          </h3>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Traditional panic buttons send a one-time message and stop. SafePath actively monitors and escalates until someone confirms they are responding.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {[
            {
              step: '01',
              title: 'Journey Monitoring',
              desc: 'Active GPS check-in interval (e.g., every 15 mins). Freshness & location accuracy tracked continuously.',
              icon: Clock,
              color: 'text-sky-400'
            },
            {
              step: '02',
              title: 'Safety Concern',
              desc: 'Check-in grace period expires or manual emergency SOS triggered. Clear, objective rule explanation.',
              icon: AlertTriangle,
              color: 'text-amber-400'
            },
            {
              step: '03',
              title: 'Alert Delivery',
              desc: 'Dispatches real-time multi-channel alerts (Email, SMS, Push) to Priority #1 contact with live map link.',
              icon: Send,
              color: 'text-rose-400'
            },
            {
              step: '04',
              title: 'Acknowledgment',
              desc: 'Contact taps secure link to view location and confirm: "I acknowledge & am responding to Maya."',
              icon: CheckCircle2,
              color: 'text-emerald-400'
            },
            {
              step: '05',
              title: 'Auto-Escalation',
              desc: 'If Priority #1 does not acknowledge within configured timeout, relay automatically escalates to Priority #2.',
              icon: Users,
              color: 'text-indigo-400'
            },
            {
              step: '06',
              title: 'Safe Resolution',
              desc: 'User or contact marks incident safely resolved with audit notes. Full event history preserved.',
              icon: Shield,
              color: 'text-teal-400'
            }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="glass-panel p-5 rounded-2xl flex flex-col justify-between hover:border-slate-600 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-slate-500 group-hover:text-slate-300">
                      {item.step}
                    </span>
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-2">{item.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature Highlights */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-bold text-white">Route Planning & ETA</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Plan your route before heading out. View distance, estimated arrival time, and customize how often SafePath should prompt you for a "I'm Safe" check-in.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-bold text-white">Offline Event Queuing (PWA)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Subway tunnels or spotty reception? SafePath uses IndexedDB to queue your check-ins and emergency actions locally, synchronizing automatically when connectivity returns.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-bold text-white">Privacy & Ephemeral Location</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              We never sell location data. Location is only streamed during an authorized active journey, and automatic data retention rules purge coordinates based on your preferences.
            </p>
          </div>
        </div>
      </section>

      {/* Transparent Product Limitations Notice */}
      <section id="limitations" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-6 sm:p-8 rounded-2xl border border-amber-600/30 bg-amber-950/20 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Honesty & Technical Limitations Disclosure
              </h3>
              <p className="text-xs text-amber-300">
                SafePath believes in total honesty regarding what software can and cannot do.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed pt-2">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <strong className="text-white block mb-1">No Guarantee of Physical Rescue</strong>
              SafePath is an automated alerting and relay coordination tool. Triggering an alert never guarantees physical rescue, nor does a missed check-in prove physical danger.
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <strong className="text-white block mb-1">Internet & Network Requirements</strong>
              Transmitting alerts to contacts requires active internet or cellular service. Offline queuing preserves events on your device but cannot transmit through the air without connectivity.
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <strong className="text-white block mb-1">Browser Background Limitations</strong>
              Standard web browsers restrict continuous GPS tracking when the screen is locked or browser is closed. Keep SafePath open during critical transit legs.
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <strong className="text-white block mb-1">No Fake AI Danger Scores</strong>
              We do not fabricate pseudoscientific "AI danger scores" or automatically accuse people nearby. Alerts trigger strictly based on transparent rules you control.
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl space-y-6 border border-indigo-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl -z-10"></div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
            Set up your Safety Circle in 2 minutes.
          </h2>
          <p className="text-slate-300 text-sm max-w-lg mx-auto">
            Invite your trusted contacts, define your escalation schedule, and travel with peace of mind.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 text-base transition-all hover:scale-[1.02]"
          >
            Create Your Free Account
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
