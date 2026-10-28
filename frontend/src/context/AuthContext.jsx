import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api.js';
import { updateSocketAuth, getSocket } from '../utils/socket.js';
import { getPendingEventsCount, flushOfflineQueue } from '../utils/idbQueue.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState(null);

  // Update pending queue count
  const refreshQueueCount = useCallback(async () => {
    const count = await getPendingEventsCount();
    setOfflineQueueCount(count);
  }, []);

  // Online / Offline state detection & sync
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      console.log('[SafePath Net] Network connection restored.');
      setSyncStatus('Syncing offline events...');
      const res = await flushOfflineQueue(api);
      if (res.synced > 0) {
        setSyncStatus(`Successfully synchronized ${res.synced} offline action(s).`);
        setTimeout(() => setSyncStatus(null), 4000);
      } else {
        setSyncStatus(null);
      }
      refreshQueueCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[SafePath Net] Network offline. Switching to local queue.');
    };

    const handleQueueChange = () => {
      refreshQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('safepath:queue-updated', handleQueueChange);

    refreshQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('safepath:queue-updated', handleQueueChange);
    };
  }, [refreshQueueCount]);

  // Load current session
  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      if (data.success && data.user) {
        setUser(data.user);
        const token = localStorage.getItem('safepath_token');
        if (token) updateSocketAuth(token);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      localStorage.removeItem('safepath_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    if (data.success) {
      setUser(data.user);
      if (data.token) {
        localStorage.setItem('safepath_token', data.token);
        updateSocketAuth(data.token);
      }
    }
    return data;
  };

  const register = async (name, email, password, phone) => {
    const data = await api.post('/auth/register', { name, email, password, phone });
    if (data.success) {
      setUser(data.user);
      if (data.token) {
        localStorage.setItem('safepath_token', data.token);
        updateSocketAuth(data.token);
      }
    }
    return data;
  };

  const loginWithGoogle = async (googlePayload) => {
    const data = await api.post('/auth/google', googlePayload);
    if (data.success) {
      setUser(data.user);
      if (data.token) {
        localStorage.setItem('safepath_token', data.token);
        updateSocketAuth(data.token);
      }
    }
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      setUser(null);
      localStorage.removeItem('safepath_token');
      updateSocketAuth(null);
    }
  };

  const updatePreferences = async (prefs) => {
    const data = await api.put('/users/preferences', prefs);
    if (data.success) {
      setUser((prev) => ({
        ...prev,
        preferences: data.preferences,
        dataRetentionDays: data.dataRetentionDays
      }));
    }
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        isOnline,
        offlineQueueCount,
        syncStatus,
        login,
        register,
        loginWithGoogle,
        logout,
        refreshUser,
        updatePreferences,
        refreshQueueCount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
