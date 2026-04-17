import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './auth-context.jsx';

import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ApplicationPage from './pages/ApplicationPage.jsx';
import PlatformLandingPage from './pages/PlatformLandingPage.jsx';
import PlatformDashboardPage from './pages/PlatformDashboardPage.jsx';
import PlatformLoginPage from './pages/PlatformLoginPage.jsx';
import PlatformTenantsPage from './pages/PlatformTenantsPage.jsx';
import PlatformTenantCreatePage from './pages/PlatformTenantCreatePage.jsx';
import PlatformTenantDetailPage from './pages/PlatformTenantDetailPage.jsx';
import PlatformTenantAdminIssuePage from './pages/PlatformTenantAdminIssuePage.jsx';
import TenantAdminLoginPage from './pages/TenantAdminLoginPage.jsx';
import TenantAdminDashboardPage from './pages/TenantAdminDashboardPage.jsx';
import AdminApplicationsPage from './pages/AdminApplicationsPage.jsx';
import AdminApplicationDetailPage from './pages/AdminApplicationDetailPage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';
import AdminSettingsPage from './pages/AdminSettingsPage.jsx';
import AdminAuditPage from './pages/AdminAuditPage.jsx';
import TenantApplyPage from './pages/TenantApplyPage.jsx';
import TenantPublicHomePage from './pages/TenantPublicHomePage.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireStaffAuth from './components/RequireStaffAuth.jsx';
import RequirePlatformAuth from './components/RequirePlatformAuth.jsx';
import { api } from './api.js';

function getHostMode() {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname === 'zanflo.com' || hostname === 'www.zanflo.com') {
    return 'apex';
  }

  if (hostname === 'platform.zanflo.com') {
    return 'platform';
  }

  return 'tenant';
}

function PlatformIndexRedirect() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.platformMe()
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setChecking(false));
  }, [navigate]);

  if (checking) {
    return <div className="spinner">Loading...</div>;
  }

  return null;
}

export default function App() {
  const { session, loading } = useAuth();
  const hostMode = getHostMode();

  if (loading) {
    return <div className="spinner">Loading...</div>;
  }

  if (hostMode === 'apex') {
    return (
      <Routes>
        <Route path="/" element={<PlatformLandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (hostMode === 'platform') {
    return (
      <Routes>
        <Route path="/" element={<PlatformIndexRedirect />} />
        <Route path="/login" element={<PlatformLoginPage />} />
        <Route
          path="/dashboard"
          element={(
            <RequirePlatformAuth>
              <PlatformDashboardPage />
            </RequirePlatformAuth>
          )}
        />
        <Route
          path="/tenants"
          element={(
            <RequirePlatformAuth>
              <PlatformTenantsPage />
            </RequirePlatformAuth>
          )}
        />
        <Route
          path="/tenants/new"
          element={(
            <RequirePlatformAuth>
              <PlatformTenantCreatePage />
            </RequirePlatformAuth>
          )}
        />
        <Route
          path="/tenants/:id"
          element={(
            <RequirePlatformAuth>
              <PlatformTenantDetailPage />
            </RequirePlatformAuth>
          )}
        />
        <Route
          path="/tenants/:id/admin"
          element={(
            <RequirePlatformAuth>
              <PlatformTenantAdminIssuePage />
            </RequirePlatformAuth>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<TenantPublicHomePage />} />
      <Route path="/apply" element={<TenantApplyPage />} />
      <Route path="/admin" element={<TenantAdminLoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/dashboard"
        element={(
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        )}
      />

      <Route
        path="/applications/:id"
        element={(
          <RequireAuth>
            <ApplicationPage />
          </RequireAuth>
        )}
      />

      <Route
        path="/admin/dashboard"
        element={(
          <RequireStaffAuth>
            <TenantAdminDashboardPage />
          </RequireStaffAuth>
        )}
      />

      <Route
        path="/admin/applications"
        element={(
          <RequireStaffAuth allowedRoles={['officer', 'manager']}>
            <AdminApplicationsPage />
          </RequireStaffAuth>
        )}
      />

      <Route
        path="/admin/applications/:id"
        element={(
          <RequireStaffAuth allowedRoles={['officer', 'manager']}>
            <AdminApplicationDetailPage />
          </RequireStaffAuth>
        )}
      />

      <Route
        path="/admin/users"
        element={(
          <RequireStaffAuth allowedRoles={['tenant_admin']}>
            <AdminUsersPage />
          </RequireStaffAuth>
        )}
      />

      <Route
        path="/admin/settings"
        element={(
          <RequireStaffAuth allowedRoles={['tenant_admin']}>
            <AdminSettingsPage />
          </RequireStaffAuth>
        )}
      />

      <Route
        path="/admin/audit"
        element={(
          <RequireStaffAuth allowedRoles={['tenant_admin']}>
            <AdminAuditPage />
          </RequireStaffAuth>
        )}
      />

      <Route
        path="*"
        element={session ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />}
      />
    </Routes>
  );
}
