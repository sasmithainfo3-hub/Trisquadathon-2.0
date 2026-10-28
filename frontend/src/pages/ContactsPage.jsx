import React, { useState, useEffect } from 'react';
import { Users, Plus, Mail, Phone, Trash2, ArrowUp, ArrowDown, Send, CheckCircle2, Clock, AlertCircle, X, Copy, ExternalLink, Sparkles, Check, MessageCircle, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
import SOSModal from '../components/SOSModal';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('Friend');
  const [notes, setNotes] = useState('');
  const [autoVerify, setAutoVerify] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);

  const loadContacts = async () => {
    try {
      const res = await api.get('/contacts');
      if (res.success) {
        setContacts(res.contacts || []);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleCreateContact = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/contacts', {
        name,
        email,
        phone,
        relationship,
        notes,
        autoVerify
      });
      if (res.success) {
        setModalOpen(false);
        setName('');
        setEmail('');
        setPhone('');
        setNotes('');
        const verifiedText = autoVerify ? 'and immediately verified!' : '! Use Instant Verify or share their link below.';
        setActionMessage(`Contact ${res.contact.name} added ${verifiedText}`);
        loadContacts();
      }
    } catch (err) {
      alert(err.message || 'Failed to add contact');
    } finally {
      setSubmitting(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const handleInstantVerify = async (contactId) => {
    try {
      const res = await api.post(`/contacts/${contactId}/instant-verify`);
      setActionMessage(res.message);
      loadContacts();
    } catch (err) {
      alert(err.message || 'Failed to verify contact');
    } finally {
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleCopyLink = (token, url) => {
    const finalUrl = url || `${window.location.origin}/verify-contact/${token}`;
    navigator.clipboard.writeText(finalUrl);
    setCopiedToken(token);
    setActionMessage('Verification link copied to clipboard! Share it with your contact.');
    setTimeout(() => {
      setCopiedToken(null);
      setActionMessage(null);
    }, 4000);
  };

  const handleMove = async (index, direction) => {
    const newContacts = [...contacts];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newContacts.length) return;

    // Swap
    const temp = newContacts[index];
    newContacts[index] = newContacts[targetIndex];
    newContacts[targetIndex] = temp;

    // Assign new priorityOrder
    const orders = newContacts.map((c, idx) => ({ id: c._id, priorityOrder: idx + 1 }));
    setContacts(newContacts);

    try {
      await api.put('/contacts/reorder', { orders });
    } catch (err) {
      loadContacts();
    }
  };

  const handleDelete = async (contactId) => {
    if (!window.confirm('Are you sure you want to remove this trusted contact?')) return;
    try {
      await api.delete(`/contacts/${contactId}`);
      loadContacts();
    } catch (err) {
      alert(err.message || 'Failed to delete contact');
    }
  };

  const handleResendInvite = async (contactId) => {
    try {
      const res = await api.post(`/contacts/${contactId}/resend-invite`);
      setActionMessage(res.message);
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      alert(err.message || 'Failed to resend invite');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-400" />
            <span>Safety Circle (Trusted Contacts)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Organize your responders in priority order. If a concern occurs, SafePath notifies Priority #1 first and escalates down the chain.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="self-start sm:self-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Trusted Contact
        </button>
      </div>

      {/* Info Tip */}
      <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-300 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">Direct Verification Available</p>
          <p className="text-slate-300">
            For testing or instant activation, you can click <strong>"Instant Verify"</strong> on any pending contact, or <strong>"Copy Link"</strong> to open their verification page directly in your browser.
          </p>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Contacts List */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs">Loading safety circle...</div>
      ) : contacts.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Trusted Contacts Added Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Add friends, family members, or colleagues to establish your Safety Relay circle.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs"
          >
            Add Your First Contact
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact, index) => (
            <div
              key={contact._id}
              className="glass-panel p-5 rounded-2xl flex flex-col space-y-3 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Priority rank */}
                  <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700/60 flex flex-col items-center justify-center text-indigo-300 shrink-0">
                    <span className="text-[9px] uppercase font-bold text-indigo-400">Rank</span>
                    <span className="text-sm font-black">#{index + 1}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white">{contact.name}</h4>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                        {contact.relationship}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          contact.status === 'verified'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                            : contact.status === 'declined'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/40 animate-pulse'
                        }`}
                      >
                        {contact.status === 'verified' ? '✓ Verified' : contact.status === 'declined' ? 'Declined' : 'Pending Verification'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-500" /> {contact.email}
                      </span>
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-500" /> {contact.phone}
                        </span>
                      )}
                    </div>
                    {contact.notes && (
                      <p className="text-[11px] text-slate-500 italic">"{contact.notes}"</p>
                    )}
                  </div>
                </div>

                {/* Priority & Reorder Controls */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                      title="Move priority up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMove(index, 1)}
                      disabled={index === contacts.length - 1}
                      className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                      title="Move priority down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleDelete(contact._id)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Remove contact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action Toolbar for Verified Contacts */}
              {contact.status === 'verified' && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-emerald-400 font-bold mr-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Verified Responder Actions:
                  </span>

                  {/* Direct WhatsApp Emergency Alert */}
                  {contact.phone && (
                    <a
                      href={`https://api.whatsapp.com/send?phone=${encodeURIComponent(contact.phone.replace(/[^0-9+]/g, ''))}&text=${encodeURIComponent(`🚨 EMERGENCY ALERT from SafePath: I have an emergency and need your immediate assistance as my Trusted Safety Contact! Live Tracking: ${window.location.origin}/dashboard`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-[11px] font-semibold rounded-lg flex items-center gap-1 border border-emerald-700/60 transition-all active:scale-95 shadow-sm shadow-emerald-900/30"
                      title="Send real emergency message directly to this contact via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      WhatsApp Alert
                    </a>
                  )}

                  {/* Direct Phone Call */}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                      className="px-2.5 py-1 bg-sky-950/80 hover:bg-sky-900 text-sky-300 text-[11px] font-semibold rounded-lg flex items-center gap-1 border border-sky-700/60 transition-all active:scale-95"
                      title={`Call ${contact.name} (${contact.phone}) directly`}
                    >
                      <Phone className="w-3.5 h-3.5 text-sky-400" />
                      Call {contact.phone}
                    </a>
                  )}

                  {/* Direct Gmail Compose */}
                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}&su=${encodeURIComponent('URGENT: SafePath Emergency Alert')}&body=${encodeURIComponent(`Hello ${contact.name},\n\nI have triggered a SafePath Emergency Alert. You are my #1 Trusted Contact.\n\nPlease check my live safety tracking here: ${window.location.origin}/dashboard\n\nThank you!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium rounded-lg flex items-center gap-1 border border-slate-700 transition-all"
                    title="Compose and send alert via Gmail"
                  >
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    Email via Gmail
                  </a>

                  {/* Trigger Emergency SOS Modal */}
                  <button
                    onClick={() => setSosModalOpen(true)}
                    className="px-2.5 py-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-md shadow-rose-600/30 transition-all active:scale-95 cursor-pointer"
                    title="Trigger emergency SOS relay now"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-white animate-bounce" />
                    Trigger SOS Alert
                  </button>
                </div>
              )}

              {/* Action Toolbar for Pending Contacts */}
              {contact.status !== 'verified' && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-amber-400 font-semibold mr-1">Verification Options:</span>

                  {/* Instant 1-Click Verify */}
                  <button
                    onClick={() => handleInstantVerify(contact._id)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                    title="Instantly mark this contact as verified for active testing"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Instant Verify
                  </button>

                  {/* Copy Link */}
                  <button
                    onClick={() => handleCopyLink(contact.verificationToken, contact.verificationUrl)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium rounded-lg flex items-center gap-1 border border-slate-700 transition-all active:scale-95"
                    title="Copy verification link to share"
                  >
                    {copiedToken === contact.verificationToken ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{copiedToken === contact.verificationToken ? 'Copied!' : 'Copy Link'}</span>
                  </button>

                  {/* Open Link */}
                  <a
                    href={contact.verificationUrl || `/verify-contact/${contact.verificationToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 text-[11px] font-medium rounded-lg flex items-center gap-1 border border-indigo-800/40 transition-all"
                    title="Open contact verification page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Page
                  </a>

                  {/* WhatsApp Invite if phone is provided */}
                  {contact.phone && (
                    <a
                      href={contact.whatsappUrl || `https://api.whatsapp.com/send?phone=${encodeURIComponent(contact.phone.replace(/[^0-9+]/g, ''))}&text=${encodeURIComponent(`Hello ${contact.name}, I added you as my Trusted Safety Contact on SafePath. Please confirm your availability: ${contact.verificationUrl || `${window.location.origin}/verify-contact/${contact.verificationToken}`}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-[11px] font-semibold rounded-lg flex items-center gap-1 border border-emerald-700/60 transition-all active:scale-95"
                      title="Send verification invitation via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      WhatsApp Invite
                    </a>
                  )}

                  {/* Native Email Client */}
                  {contact.mailtoUrl && (
                    <a
                      href={contact.mailtoUrl}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium rounded-lg flex items-center gap-1 border border-slate-700 transition-all"
                      title="Send invitation from your default email app"
                    >
                      <Mail className="w-3.5 h-3.5 text-indigo-400" />
                      Send via Email
                    </a>
                  )}

                  {/* Resend Email */}
                  <button
                    onClick={() => handleResendInvite(contact._id)}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-medium rounded-lg flex items-center gap-1 border border-slate-800 transition-all"
                  >
                    <Send className="w-3 h-3" />
                    Resend Backend
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Contact Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add Trusted Contact</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Elena Rostova"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Relationship</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Family">Family Member</option>
                  <option value="Partner">Partner / Spouse</option>
                  <option value="Friend">Close Friend</option>
                  <option value="Roommate">Roommate</option>
                  <option value="Colleague">Colleague</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Lives 10 minutes away, has spare key..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-950/40 border border-indigo-700/40">
                <input
                  type="checkbox"
                  id="autoVerify"
                  checked={autoVerify}
                  onChange={(e) => setAutoVerify(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="autoVerify" className="text-xs text-slate-300 cursor-pointer select-none">
                  <span className="font-semibold text-white block">Auto-Verify Immediately</span>
                  <span className="text-[11px] text-slate-400">Activates this contact immediately so they can receive real safety alerts without waiting for external email clicks.</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                {submitting ? 'Adding Contact...' : autoVerify ? 'Save & Verify Immediately' : 'Save & Send Invitation'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Emergency SOS Modal */}
      <SOSModal isOpen={sosModalOpen} onClose={() => setSosModalOpen(false)} />
    </div>
  );
}
