import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { usePlatformAuth } from '../components/RequirePlatformAuth.jsx';

export default function PlatformTenantsPage() {
  const { session, logout } = usePlatformAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listPlatformTenants()
      .then((data) => setTenants(data.tenants ?? []))
      .catch((err) => setError(err.message || 'Could not load tenants.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout session={session} onSignOut={logout} brandTarget="/dashboard">
      <section className="form-section">
        <div className="form-section-title">Platform operations</div>
        <h1 className="page-title">Tenants</h1>
        <p className="page-subtitle">Manual onboarding and tenant lifecycle control stay in the platform console.</p>
        <div className="platform-hero-actions" style={{ marginTop: 16 }}>
          <Link className="btn btn-primary" to="/tenants/new">Create tenant</Link>
          <Link className="btn btn-secondary" to="/dashboard">Back to dashboard</Link>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="form-section">
        <div className="form-section-title">Tenant list</div>
        {loading ? (
          <div className="spinner">Loading...</div>
        ) : tenants.length === 0 ? (
          <p className="empty-state">No tenants found.</p>
        ) : (
          <div className="application-list">
            {tenants.map((tenant) => (
              <Link key={tenant.id} className="application-row" to={`/tenants/${tenant.id}`}>
                <div className="application-row-main">
                  <div className="application-row-title">{tenant.name}</div>
                  <div className="application-row-meta">
                    {tenant.subdomain}.zanflo.com | Status: {tenant.status}
                  </div>
                  <div className="application-row-meta">
                    Staff users: {tenant.staff_count ?? 0}
                  </div>
                  <div className="application-row-meta">
                    Bootstrap owner: {tenant.bootstrap_owner_name || 'Not issued'} {tenant.bootstrap_owner_email ? `| ${tenant.bootstrap_owner_email}` : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
