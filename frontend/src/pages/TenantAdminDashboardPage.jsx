import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { useStaffAuth } from '../components/RequireStaffAuth.jsx';

export default function TenantAdminDashboardPage() {
  const { session, logout } = useStaffAuth();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (session.role !== 'tenant_admin') return;
    api.getAdminSettings().then((data) => setSettings(data.settings)).catch(() => {});
  }, [session.role]);

  return (
    <Layout session={session} onSignOut={logout} brandTarget="/admin/dashboard" signOutTarget="/admin">
      <section className="form-section">
        <div className="form-section-title">Tenant staff workspace</div>
        <h1 className="page-title">Admin dashboard</h1>
        <p className="page-subtitle">
          Review applications, manage tenant administration, and keep staff work separate from the public applicant portal.
        </p>
      </section>

      {session.role === 'tenant_admin' && settings && (
        <section className="platform-feature-grid">
          <article className="platform-feature-card">
            <h2>Organisation settings</h2>
            <p>{settings.organisation.council_display_name || settings.organisation.council_name}</p>
            <Link className="btn btn-secondary" to="/admin/settings">Open setup workspace</Link>
          </article>
          <article className="platform-feature-card">
            <h2>Branding and homepage</h2>
            <p>{settings.branding.welcome_text || 'Add welcome text and public homepage details for applicants.'}</p>
            <Link className="btn btn-secondary" to="/admin/settings">Update public site</Link>
          </article>
          <article className="platform-feature-card">
            <h2>Identity and SSO</h2>
            <p>{settings.sso.auth_runtime_status === 'configuration_only' ? 'Configuration can be saved now. Live SSO sign-in is not active yet.' : settings.sso.auth_runtime_status}</p>
            <Link className="btn btn-secondary" to="/admin/settings">Review identity settings</Link>
          </article>
        </section>
      )}

      <section className="platform-feature-grid">
        {['officer', 'manager'].includes(session.role) && (
          <article className="platform-feature-card">
            <h2>Application queue</h2>
            <p>Pick up submitted applications, review current cases, and complete decisions.</p>
            <Link className="btn btn-primary" to="/admin/applications">Open queue</Link>
          </article>
        )}

        <article className="platform-feature-card">
          <h2>Tenant users</h2>
          <p>Manage tenant staff access and role assignment within this council only.</p>
          <Link className="btn btn-secondary" to="/admin/users">Manage users</Link>
        </article>

        <article className="platform-feature-card">
          <h2>Settings and audit</h2>
          <p>Keep tenant contact details current and review recent tenant-scoped activity.</p>
          <div className="platform-hero-actions">
            <Link className="btn btn-secondary" to="/admin/settings">Settings</Link>
            <Link className="btn btn-secondary" to="/admin/audit">Audit</Link>
          </div>
        </article>
      </section>

      <section className="form-section">
        <div className="form-section-title">Current access</div>
        <p className="platform-body-copy">
          Signed in as <strong>{session.full_name || session.email}</strong>.
        </p>
        <p className="platform-body-copy">
          Tenant role: <strong>{session.role}</strong>
        </p>
      </section>
    </Layout>
  );
}
