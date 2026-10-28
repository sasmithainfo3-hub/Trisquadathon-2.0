import React from 'react';
import { Shield, AlertTriangle, PhoneCall, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400 py-12 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Core Disclaimer Box */}
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-xs sm:text-sm text-rose-200/90 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-300">
              Important Product & Legal Transparency Notice
            </p>
            <p className="leading-relaxed text-slate-300">
              SafePath is an automated journey monitoring and contact notification relay. <strong>SafePath never claims that an alert guarantees physical rescue</strong>, nor that an unacknowledged check-in proves physical danger. SafePath does not replace police, ambulance, or municipal 911/112 emergency services. In immediate life-threatening danger, always contact local emergency dispatch directly if safe to do so.
            </p>
          </div>
        </div>

        {/* 4 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Shield className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-base">SafePath</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Engineered with a persistent Safety Relay: monitoring journeys, dispatching multi-channel alerts, and escalating until a verified trusted contact acknowledges.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">Platform</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/plan" className="hover:text-white transition-colors">Journey Planner</Link></li>
              <li><Link to="/contacts" className="hover:text-white transition-colors">Trusted Safety Circle</Link></li>
              <li><Link to="/timeline" className="hover:text-white transition-colors">Event Timeline</Link></li>
              <li><Link to="/settings" className="hover:text-white transition-colors">Privacy & Data Retention</Link></li>
            </ul>
          </div>

          {/* Device Limitations */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">Browser & Mobile Limitations</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>• Requires active internet for real-time dispatch</li>
              <li>• Offline check-ins are queued locally via IndexedDB</li>
              <li>• Web browsers do not guarantee continuous background tracking when screen is locked</li>
              <li>• Real push notifications require explicit user permission</li>
            </ul>
          </div>

          {/* Emergency Hotlines */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3 flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-indigo-400" /> Crisis Resources
            </h4>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <p className="font-medium text-white">Police / Medical Emergency</p>
                <p className="text-indigo-400 font-bold text-sm">Dial 911 (US) / 112 (EU/IN)</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <p className="font-medium text-white">National Domestic Violence Hotline</p>
                <p className="text-indigo-400 font-semibold">1-800-799-SAFE (7233)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} SafePath Engineering. Built for resilient personal safety.</p>
          <div className="flex items-center gap-4">
            <Link to="/settings" className="hover:text-slate-400">Privacy Policy</Link>
            <Link to="/settings" className="hover:text-slate-400">Data Retention</Link>
            <span className="flex items-center gap-1">Built with care for women's safety</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
