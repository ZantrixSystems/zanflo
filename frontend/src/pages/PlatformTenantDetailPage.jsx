import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { usePlatformAuth } from '../components/RequirePlatformAuth.jsx';

export default function PlatformTenantDetailPage() {
  const { id } = useParams();
  const { session, logout } = usePlatformAuth();
  const [tenant, setTenant] = useState(null);
  const [status, setStatus] = useState('pending_setup');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadTenant() {
    const data = await api.getPlatformTenant(id);
    setTenant(data);
    setStatus(data.status);
  }

  useEffect(() => {
    loadTenant()
      .catch((err) => setError(err.message || 'Could not load tenant.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusUpdate() {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const data = await api.updatePlatformTenantStatus(id, { status });
      setTenant((current) => ({ ...current, ...data }));
      setNotice('Tenant status updated.');
    } catch (err) {
      setError(err.message || 'Could not update tenant status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout session={session} onSignOut={logout} brandTarget="/dashboard">
      <Link to="/tenants" className="back-link">
        Back to tenants
      </Link>

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : !tenant ? (
        <div className="alert alert-error">Tenant not found.</div>
      ) : (
        <>
          <section className="form-section">
            <div className="form-section-title">Platform operations</div>
            <h1 className="page-title">{tenant.name}</h1>
            <p className="page-subtitle">{tenant.subdomain}.zanflo.com</p>
            <p className="platform-body-copy"><strong>Slug:</strong> {tenant.slug}</p>
            <p className="platform-body-copy"><strong>Status:</strong> {tenant.status}</p>
            <p className="platform-body-copy"><strong>Contact:</strong> {tenant.contact_name || 'Not set'} {tenant.contact_email ? `| ${tenant.contact_email}` : ''}</p>
          </section>

          {error && <div className="alert alert-error">{error}</div>}
          {notice && <div className="alert alert-success">{notice}</div>}

          <section className="form-section">
            <div className="form-section-title">Lifecycle</div>
            <div className="form-group">
              <label htmlFor="tenant-status">Tenant status</label>
              <select id="tenant-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="pending_setup">Pending setup</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div className="platform-hero-actions">
              <button type="button" className="btn btn-primary" onClick={handleStatusUpdate} disabled={saving}>
                {saving ? 'Saving...' : 'Update status'}
              </button>
              <Link className="btn btn-secondary" to={`/tenants/${tenant.id}/admin`}>Issue initial admin</Link>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-title">Limits</div>
            <p className="platform-body-copy"><strong>Max staff users:</strong> {tenant.max_staff_users ?? 'Not set'}</p>
            <p className="platform-body-copy"><strong>Max applications:</strong> {tenant.max_applications ?? 'Not set'}</p>
          </section>
        </>
      )}
    </Layout>
  );
}
