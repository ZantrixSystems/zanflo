import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { usePlatformAuth } from '../components/RequirePlatformAuth.jsx';

export default function PlatformTenantAdminIssuePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, logout } = usePlatformAuth();
  const [form, setForm] = useState({ email: '', full_name: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.issuePlatformTenantAdmin(id, form);
      navigate(`/tenants/${id}`);
    } catch (err) {
      setError(err.message || 'Could not issue tenant admin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout session={session} onSignOut={logout} brandTarget="/dashboard">
      <Link to={`/tenants/${id}`} className="back-link">
        Back to tenant
      </Link>

      <section className="form-section">
        <div className="form-section-title">Platform operations</div>
        <h1 className="page-title">Issue initial tenant admin</h1>
        <p className="page-subtitle">
          Create the break-glass tenant admin account for this tenant.
        </p>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="form-section">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="tenant-admin-email">Email</label>
            <input id="tenant-admin-email" type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="tenant-admin-name">Full name</label>
            <input id="tenant-admin-name" value={form.full_name} onChange={(event) => setField('full_name', event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="tenant-admin-password">Temporary password</label>
            <input id="tenant-admin-password" type="password" value={form.password} onChange={(event) => setField('password', event.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Issuing...' : 'Issue tenant admin'}
          </button>
        </form>
      </section>
    </Layout>
  );
}
