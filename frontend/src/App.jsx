import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth-context.jsx';

import LoginPage       from './pages/LoginPage.jsx';
import RegisterPage    from './pages/RegisterPage.jsx';
import DashboardPage   from './pages/DashboardPage.jsx';
import ApplicationPage from './pages/ApplicationPage.jsx';
import RequireAuth     from './components/RequireAuth.jsx';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="spinner">Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />

      <Route
        path="/applications/:id"
        element={
          <RequireAuth>
            <ApplicationPage />
          </RequireAuth>
        }
      />

      {/* Default: redirect to dashboard if logged in, login if not */}
      <Route
        path="*"
        element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
