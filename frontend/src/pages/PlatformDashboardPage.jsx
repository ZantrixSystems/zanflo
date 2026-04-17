import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { usePlatformAuth } from '../components/RequirePlatformAuth.jsx';

export default function PlatformDashboardPage() {
  const { session, logout } = usePlatformAuth();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    api.listPlatformTenants()
      .then((data) => {
        if (!mounted) return;
        setTenants(data.tenants ?? []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'Could not load platform dashboard.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Layout session={session} onSignOut={logout} brandTarget="/dashboard">
      <section className="form-section platform-admin-shell">
        <div className="form-section-title">Platform admin</div>
        <h1 className="page-title">Tenant operations dashboard</h1>
        <p className="page-subtitle">
          Platform-level access stays separate from tenant staff and applicant access.
        </p>

        {loading && <div className="spinner">Loading...</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && session && (
          <>
            <p className="platform-body-copy">
              Signed in as <strong>{session.full_name || session.email}</strong>.
            </p>
            <div className="platform-hero-actions" style={{ marginBottom: 24 }}>
              <Link className="btn btn-primary" to="/tenants/new">Create tenant</Link>
              <Link className="btn btn-secondary" to="/tenants">View all tenants</Link>
            </div>

            <div className="form-section">
              <div className="form-section-title">Recent tenants</div>
              {tenants.length === 0 ? (
                <p className="empty-state">No tenants found.</p>
              ) : (
                <div className="application-list">
                  {tenants.slice(0, 5).map((tenant) => (
                    <div key={tenant.id} className="application-row">
                      <div className="application-row-main">
                        <div className="application-row-title">
                          <Link to={`/tenants/${tenant.id}`}>{tenant.name}</Link>
                        </div>
                        <div className="application-row-meta">
                          {tenant.subdomain}.zanflo.com | Status: {tenant.status} | Staff users: {tenant.staff_count ?? 0}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </Layout>
  );
}
