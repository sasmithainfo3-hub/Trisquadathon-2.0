import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Shield, User, Bell, Trash2, Download, CheckCircle2, AlertTriangle, Lock, Volume2, VolumeX, BellRing } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import {
  isBreakthroughEnabled,
  setBreakthroughEnabled,
  triggerUnsilentReminder
} from '../utils/silentBreakthrough';

export default function SettingsPage() {
  const { user, updatePreferences, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [checkInGrace, setCheckInGrace] = useState(user?.preferences?.checkInGracePeriodMinutes || 5);
  const [escalationTimeout, setEscalationTimeout] = useState(user?.preferences?.defaultEscalationTimeoutMinutes || 10);
  const [emergencyGrace, setEmergencyGrace] = useState(user?.preferences?.emergencyGracePeriodSeconds || 10);
  const [notifyEmail, setNotifyEmail] = useState(user?.preferences?.notifyEmail ?? true);
  const [notifyPush, setNotifyPush] = useState(user?.preferences?.notifyPush ?? true);
  const [notifySms, setNotifySms] = useState(user?.preferences?.notifySms ?? false);
  const [dataRetentionDays, setDataRetentionDays] = useState(user?.dataRetentionDays || 30);
  const [unsilentReminder, setUnsilentReminder] = useState(isBreakthroughEnabled());

  const [profileSaving, setProfileSaving] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Deletion modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await api.put('/users/profile', { name, phone });
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePreferences = async (e) => {
    e.preventDefault();
    setPrefsSaving(true);
    try {
      setBreakthroughEnabled(unsilentReminder);
      await updatePreferences({
        checkInGracePeriodMinutes: Number(checkInGrace),
        defaultEscalationTimeoutMinutes: Number(escalationTimeout),
        emergencyGracePeriodSeconds: Number(emergencyGrace),
        notifyEmail,
        notifyPush,
        notifySms,
        dataRetentionDays: Number(dataRetentionDays)
      });
      setMessage('Safety relay preferences updated!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update preferences');
    } finally {
      setPrefsSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const res = await api.get('/users/export');
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safepath-export-${user?.id || 'archive'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export data: ' + err.message);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.delete('/users/account', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword })
      });
      await logout();
      navigate('/');
    } catch (err) {
      setDeleteError(err.message || 'Incorrect password.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Settings & Privacy</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Customize your Safety Relay escalation thresholds, notification channels, and data retention rules.
        </p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {message}
        </div>
      )}

      {/* Profile Section */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-400" /> Profile Information
        </h3>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-500 cursor-not-allowed"
            />
            <span className="text-[10px] text-slate-500">Contact support to update primary email address.</span>
          </div>

          <button
            type="submit"
            disabled={profileSaving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all"
          >
            {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Safety Relay Engine Configuration */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" /> Safety Relay Escalation Policy
        </h3>
        <p className="text-xs text-slate-400">
          Configure how the state machine behaves when a check-in is pending or an alert is unacknowledged.
        </p>

        <form onSubmit={handleUpdatePreferences} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Check-In Grace Window
              </label>
              <select
                value={checkInGrace}
                onChange={(e) => setCheckInGrace(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
              >
                <option value={3}>3 minutes</option>
                <option value={5}>5 minutes (Standard)</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
              <span className="text-[10px] text-slate-500 block mt-1">
                Extra time to confirm "I'm Safe" before alert initiates.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Escalation Timeout
              </label>
              <select
                value={escalationTimeout}
                onChange={(e) => setEscalationTimeout(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes (Standard)</option>
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
              </select>
              <span className="text-[10px] text-slate-500 block mt-1">
                Time before notifying next contact if current contact is silent.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                SOS Cancellation Grace
              </label>
              <select
                value={emergencyGrace}
                onChange={(e) => setEmergencyGrace(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
              >
                <option value={0}>0s (Immediate dispatch)</option>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds (Standard)</option>
                <option value={15}>15 seconds</option>
              </select>
              <span className="text-[10px] text-slate-500 block mt-1">
                Countdown window to abort accidental SOS clicks.
              </span>
            </div>
          </div>

          {/* Notification Channels */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Dispatch Notification Channels
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span className="text-xs text-slate-300 font-semibold">Resend Email</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyPush}
                  onChange={(e) => setNotifyPush(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span className="text-xs text-slate-300 font-semibold">Web Push</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifySms}
                  onChange={(e) => setNotifySms(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span className="text-xs text-slate-300 font-semibold">Twilio SMS</span>
              </label>
            </div>
          </div>

          {/* Silent Mode Breakthrough Setting */}
          <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${unsilentReminder ? 'bg-indigo-600/30 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                  {unsilentReminder ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    Unsilent Phone for Check-In Reminders
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                      MEDIA CHANNEL
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Bypasses phone silent/vibrate switch to sound safety check-in reminders and grace period alerts via media audio.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={unsilentReminder}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setUnsilentReminder(val);
                    setBreakthroughEnabled(val);
                    if (val) {
                      triggerUnsilentReminder({
                        title: '🔊 Unsilent Mode Enabled',
                        body: 'SafePath check-in reminders will sound through media audio even if phone is on silent.',
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
              <span className="text-slate-400">Hear what the reminder alert sounds like:</span>
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
                <BellRing className="w-3 h-3 text-amber-400" /> Test Breakthrough Chime
              </button>
            </div>
          </div>

          {/* Data retention */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Location Data Retention Policy
            </label>
            <select
              value={dataRetentionDays}
              onChange={(e) => setDataRetentionDays(e.target.value)}
              className="w-full sm:w-64 px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
            >
              <option value={7}>Auto-purge after 7 days</option>
              <option value={14}>Auto-purge after 14 days</option>
              <option value={30}>Auto-purge after 30 days (Standard)</option>
              <option value={90}>Auto-purge after 90 days</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={prefsSaving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all"
          >
            {prefsSaving ? 'Updating...' : 'Save Escalation Preferences'}
          </button>
        </form>
      </div>

      {/* GDPR Data Portability & Deletion */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Download className="w-4 h-4 text-emerald-400" /> Data Portability & Account Deletion
        </h3>
        <p className="text-xs text-slate-400">
          In full accordance with GDPR and CCPA privacy standards, you can download all personal records or permanently delete your account and all associated trips and contact records.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleExportData}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Download Complete JSON Archive
          </button>

          <button
            onClick={() => setDeleteModalOpen(true)}
            className="px-4 py-2.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 font-semibold rounded-xl text-xs flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            Permanently Delete Account
          </button>
        </div>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-rose-500/60 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Account Deletion</h3>
                <p className="text-xs text-slate-400">This action is irreversible and purges all records.</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-300">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Enter Password to Confirm
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Your account password"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="w-1/2 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading}
                  className="w-1/2 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
