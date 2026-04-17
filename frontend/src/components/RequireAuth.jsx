import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';

export default function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="spinner">Loading...</div>;
  if (!session) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}
