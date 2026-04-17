import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';

const PlatformAuthContext = createContext(null);

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error('usePlatformAuth must be used within RequirePlatformAuth');
  return ctx;
}

export default function RequirePlatformAuth({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.platformMe()
      .then((data) => setSession(data.session))
      .catch(() => setSession(false))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await api.platformLogout();
    setSession(false);
  }

  async function refresh() {
    const data = await api.platformMe();
    setSession(data.session);
    return data.session;
  }

  const value = useMemo(() => ({ session, logout, refresh }), [session]);

  if (loading) return <div className="spinner">Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <PlatformAuthContext.Provider value={value}>
      {children}
    </PlatformAuthContext.Provider>
  );
}
