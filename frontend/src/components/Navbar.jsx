import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Bell, Menu, X, LogOut, Settings, Clock, Users, Navigation, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { getSocket } from '../utils/socket';
import SOSModal from './SOSModal';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTrip, setActiveTrip] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch unread notifications
    api.get('/notifications').then((res) => {
      if (res.success) setUnreadCount(res.unreadCount || 0);
    }).catch(() => {});

    // Fetch active trip
    api.get('/trips?status=active&limit=1').then((res) => {
      if (res.success && res.trips?.length > 0) {
        setActiveTrip(res.trips[0]);
      } else {
        setActiveTrip(null);
      }
    }).catch(() => {});

    // Listen to real-time events
    const socket = getSocket();
    const handleTripUpdate = (data) => {
      if (data.trip?.status === 'active') setActiveTrip(data.trip);
      else setActiveTrip(null);
    };

    socket.on('trip:started', handleTripUpdate);
    socket.on('trip:completed', () => setActiveTrip(null));
    socket.on('trip:cancelled', () => setActiveTrip(null));

    socket.on('notification:new', () => {
      setUnreadCount((c) => c + 1);
    });

    return () => {
      socket.off('trip:started', handleTripUpdate);
      socket.off('trip:completed');
      socket.off('trip:cancelled');
      socket.off('notification:new');
    };
  }, [isAuthenticated, location.pathname]);

  const navLinks = isAuthenticated
    ? [
        { name: 'Dashboard', path: '/dashboard', icon: Navigation },
        { name: 'Plan Journey', path: '/plan', icon: Navigation },
        ...(activeTrip ? [{ name: 'Active Trip', path: `/active`, badge: 'LIVE', icon: Clock }] : []),
        { name: 'Safety Circle', path: '/contacts', icon: Users },
        { name: 'Timeline', path: '/timeline', icon: Clock },
      ]
    : [
        { name: 'How It Works', path: '/#how-it-works' },
        { name: 'Safety Relay', path: '/#safety-relay' },
        { name: 'Limitations', path: '/#limitations' },
      ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="glass-panel sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                SafePath
              </span>
              <span className="text-[10px] tracking-wider text-indigo-400 font-semibold uppercase -mt-1">
                Safety Relay
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {link.badge && (
                    <span className="relative flex h-2 w-2 mr-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Right Action Icons & Auth */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Global Emergency SOS Trigger */}
                <button
                  onClick={() => setSosModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-lg shadow-rose-600/30 border border-rose-400/50 animate-pulse transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="Instant Emergency SOS"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-white animate-bounce" />
                  <span>SOS</span>
                </button>

                {/* Notifications Bell */}
                <Link
                  to="/notifications"
                  className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                  aria-label="Notification center"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Settings */}
                <Link
                  to="/settings"
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                  aria-label="Account Settings"
                >
                  <Settings className="w-5 h-5" />
                </Link>

                {/* User avatar & logout */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-indigo-900/60 border border-indigo-700/50 flex items-center justify-center font-bold text-xs text-indigo-300">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02]"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            {isAuthenticated && (
              <>
                <button
                  onClick={() => setSosModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-md shadow-md animate-pulse"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>SOS</span>
                </button>
                <Link to="/notifications" className="relative p-2 text-slate-300">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-rose-500 rounded-full text-[9px] text-white flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              </>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-900/95 px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <div className="flex items-center justify-between">
                <span>{link.name}</span>
                {link.badge && (
                  <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded font-bold">
                    {link.badge}
                  </span>
                )}
              </div>
            </Link>
          ))}

          {isAuthenticated ? (
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-slate-300 text-sm font-medium"
              >
                <Settings className="w-4 h-4" /> Settings
              </Link>
              <button
                onClick={handleLogout}
                className="text-rose-400 text-sm font-medium flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" /> Log out
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-sm text-slate-300 hover:text-white"
              >
                Log in
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-sm bg-indigo-600 text-white rounded-lg font-semibold"
              >
                Get Started Free
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Persistent Global Emergency SOS Modal */}
      <SOSModal isOpen={sosModalOpen} onClose={() => setSosModalOpen(false)} />
    </nav>
  );
}
