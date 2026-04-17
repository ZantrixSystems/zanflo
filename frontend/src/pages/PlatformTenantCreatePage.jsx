import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { usePlatformAuth } from '../components/RequirePlatformAuth.jsx';

const INITIAL_FORM = {
  name: '',
  slug: '',
  subdomain: '',
  status: 'pending_setup',
  contact_name: '',
  contact_email: '',
  max_staff_users: 3,
  max_applications: 50,
};

export default function PlatformTenantCreatePage() {
  const { session, logout } = usePlatformAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
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
      const tenant = await api.createPlatformTenant({
        ...form,
        max_staff_users: Number(form.max_staff_users),
        max_applications: Number(form.max_applications),
      });
      navigate(`/tenants/${tenant.id}`);
    } catch (err) {
      setError(err.message || 'Could not create tenant.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout session={session} onSignOut={logout} brandTarget="/dashboard">
      <section className="form-section">
        <div className="form-section-title">Platform operations</div>
        <h1 className="page-title">Create tenant</h1>
        <p className="page-subtitle">Manual tenant onboarding is the active MVP path.</p>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="form-section">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="tenant-create-name">Tenant name</label>
            <input id="tenant-create-name" value={form.name} onChange={(event) => setField('name', event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="tenant-create-slug">Slug</label>
            <input id="tenant-create-slug" value={form.slug} onChange={(event) => setField('slug', event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="tenant-create-subdomain">Subdomain</label>
            <input id="tenant-create-subdomain" value={form.subdomain} onChange={(event) => setField('subdomain', event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="tenant-create-status">Status</label>
            <select id="tenant-create-status" value={form.status} onChange={(event) => setField('status', event.target.value)}>
              <option value="pending_setup">Pending setup</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="tenant-create-contact-name">Contact name</label>
            <input id="tenant-create-contact-name" value={form.contact_name} onChange={(event) => setField('contact_name', event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="tenant-create-contact-email">Contact email</label>
            <input id="tenant-create-contact-email" type="email" value={form.contact_email} onChange={(event) => setField('contact_email', event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="tenant-create-max-staff">Max staff users</label>
            <input id="tenant-create-max-staff" type="number" min="1" value={form.max_staff_users} onChange={(event) => setField('max_staff_users', event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="tenant-create-max-applications">Max applications</label>
            <input id="tenant-create-max-applications" type="number" min="1" value={form.max_applications} onChange={(event) => setField('max_applications', event.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create tenant'}
          </button>
        </form>
      </section>
    </Layout>
  );
}
