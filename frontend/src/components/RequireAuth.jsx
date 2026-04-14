/**
 * Route guard — redirects to /login if no active applicant session.
 * Shows nothing while the session check is in progress (avoids flash).
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';

export default function RequireAuth({ children }) {
  const { session, loading } = useAuth();

  if (loading) return <div className="spinner">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;

  return children;
}
