/**
 * Auth context — holds the current applicant session.
 *
 * On mount, calls /applicant/me to check if a session cookie exists.
 * Components use useAuth() to access session state and auth actions.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null);  // null = unknown, false = logged out
  const [loading, setLoading]   = useState(true);

  // Check existing session on mount
  useEffect(() => {
    api.me()
      .then((data) => setSession(data.session))
      .catch(() => setSession(false))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    const meData = await api.me();
    setSession(meData.session);
    return data;
  }, []);

  const register = useCallback(async (email, password, fullName, phone) => {
    const data = await api.register({ email, password, full_name: fullName, phone: phone || undefined });
    const meData = await api.me();
    setSession(meData.session);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setSession(false);
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
