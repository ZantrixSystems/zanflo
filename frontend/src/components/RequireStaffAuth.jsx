import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';

const StaffAuthContext = createContext(null);

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error('useStaffAuth must be used within RequireStaffAuth');
  return ctx;
}

export default function RequireStaffAuth({ children, allowedRoles = null }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.staffMe()
      .then((data) => setSession(data.session))
      .catch(() => setSession(false))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await api.staffLogout();
    setSession(false);
  }

  async function refresh() {
    const data = await api.staffMe();
    setSession(data.session);
    return data.session;
  }

  const value = useMemo(() => ({ session, logout, refresh }), [session]);

  if (loading) return <div className="spinner">Loading...</div>;
  if (!session) return <Navigate to="/admin" replace />;
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <StaffAuthContext.Provider value={value}>
      {children}
    </StaffAuthContext.Provider>
  );
}
