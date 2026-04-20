import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';

export default function ApplicantProfilePage() {
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getProfile()
      .then(({ profile }) => setForm({ full_name: profile.full_name ?? '', phone: profile.phone ?? '' }))
      .catch((err) => setError(err.message || 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSuccess('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.updateProfile({ full_name: form.full_name, phone: form.phone });
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <section className="form-section">
        <p style={{ marginBottom: 8 }}>
          <Link to="/dashboard">← Back to dashboard</Link>
        </p>
        <h1 className="page-title">Your profile</h1>
        <p className="page-subtitle">Update your name and contact details.</p>
      </section>

      {loading ? (
        <div className="spinner">Loading…</div>
      ) : (
        <section className="form-section">
          {error   && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="full_name">Full name</label>
              <input
                id="full_name"
                type="text"
                value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">
                Phone number{' '}
                <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                autoComplete="tel"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>
      )}
    </Layout>
  );
}
