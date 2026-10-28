import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';

export default function VerifyContactPage() {
  const { token } = useParams();

  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionDone, setActionDone] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadInvitation() {
      try {
        const res = await api.get(`/contacts/verify/${token}`);
        if (res.success) {
          setContact(res.contact);
        } else {
          setError(res.message || 'Invitation is invalid or has expired.');
        }
      } catch (err) {
        setError(err.message || 'Failed to load invitation.');
      } finally {
        setLoading(false);
      }
    }

    loadInvitation();
  }, [token]);

  const handleAction = async (action) => {
    try {
      const res = await api.post(`/contacts/verify/${token}`, { action });
      if (res.success) {
        setActionDone(action);
      }
    } catch (err) {
      alert(err.message || 'Failed to submit response');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Invitation Unavailable</h2>
        <p className="text-xs text-slate-400">{error || 'This invitation link is no longer valid.'}</p>
        <Link to="/" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold block">
          Visit SafePath Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full glass-panel-elevated p-8 rounded-2xl border border-slate-800 space-y-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto text-white shadow-lg shadow-indigo-600/30">
          <Shield className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            Safety Circle Invitation
          </span>
          <h2 className="text-2xl font-black text-white mt-1">Hello {contact.name}!</h2>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            <strong>{contact.inviterName}</strong> has added you as their trusted safety contact on SafePath.
          </p>
        </div>

        {actionDone ? (
          <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-2">
            {actionDone === 'accept' ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">You're All Set!</h4>
                <p className="text-xs text-slate-300">
                  Thank you! You are now confirmed as a trusted safety contact for {contact.inviterName}. You will only be alerted if an emergency or unconfirmed check-in occurs.
                </p>
              </>
            ) : (
              <>
                <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Invitation Declined</h4>
                <p className="text-xs text-slate-300">
                  You have declined this safety contact invitation. No further notifications will be sent to you.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-400 text-left space-y-2">
              <p className="text-white font-semibold">What being a trusted contact means:</p>
              <ul className="space-y-1 list-disc pl-4">
                <li>You will NOT receive daily notifications or spam.</li>
                <li>If {contact.inviterName} misses a safety check-in, you receive an alert link with their last known GPS coordinates.</li>
                <li>You can acknowledge the alert with one tap to confirm you are responding.</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleAction('accept')}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 text-sm transition-all"
              >
                Accept & Confirm Availability
              </button>
              <button
                onClick={() => handleAction('decline')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Decline Invitation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
