import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { useStaffAuth } from '../components/RequireStaffAuth.jsx';

export default function AdminSettingsPage() {
  const { session, logout } = useStaffAuth();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ name: '', contact_name: '', contact_email: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.getAdminSettings()
      .then((data) => {
        setSettings(data.settings);
        setForm({
          name: data.settings.name || '',
          contact_name: data.settings.contact_name || '',
          contact_email: data.settings.contact_email || '',
        });
      })
      .catch((err) => setError(err.message || 'Could not load tenant settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const data = await api.updateAdminSettings(form);
      setSettings(data.settings);
      setNotice('Tenant settings updated.');
    } catch (err) {
      setError(err.message || 'Could not update tenant settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout session={session} onSignOut={logout} brandTarget="/admin/dashboard" signOutTarget="/admin">
      <section className="form-section">
        <div className="form-section-title">Tenant administration</div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Keep the tenant identity and contact details current.</p>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : (
        <>
          <section className="form-section">
            <div className="form-section-title">Tenant record</div>
            <p className="platform-body-copy"><strong>Slug:</strong> {settings?.slug}</p>
            <p className="platform-body-copy"><strong>Subdomain:</strong> {settings?.subdomain}.zanflo.com</p>
            <p className="platform-body-copy"><strong>Status:</strong> {settings?.status}</p>
          </section>

          <section className="form-section">
            <div className="form-section-title">Editable details</div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="tenant-name">Tenant name</label>
                <input id="tenant-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="tenant-contact-name">Contact name</label>
                <input id="tenant-contact-name" value={form.contact_name} onChange={(event) => setForm((current) => ({ ...current, contact_name: event.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="tenant-contact-email">Contact email</label>
                <input id="tenant-contact-email" type="email" value={form.contact_email} onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </form>
          </section>
        </>
      )}
    </Layout>
  );
}
