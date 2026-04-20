import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';

export default function ApplicantProfilePage() {
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [originalEmail, setOriginalEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getProfile()
      .then(({ profile }) => {
        setOriginalEmail(profile.email ?? '');
        setForm((f) => ({
          ...f,
          full_name: profile.full_name ?? '',
          phone: profile.phone ?? '',
          email: profile.email ?? '',
        }));
      })
      .catch((err) => setError(err.message || 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSuccess('');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.new_password && form.new_password !== form.confirm_password) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await api.updateProfile({
        full_name:        form.full_name,
        phone:            form.phone,
        email:            form.email,
        current_password: form.current_password || undefined,
        new_password:     form.new_password || undefined,
      });
      setSuccess('Profile updated.');
      setForm((f) => ({ ...f, current_password: '', new_password: '', confirm_password: '' }));
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  const changingCredentials = form.new_password || form.email !== originalEmail;

  return (
    <Layout>
      <section className="form-section">
        <p style={{ marginBottom: 8 }}>
          <Link to="/dashboard">← Back to dashboard</Link>
        </p>
        <h1 className="page-title">Your profile</h1>
        <p className="page-subtitle">Update your details. To change your email or password, enter your current password to confirm.</p>
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

            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-section-title" style={{ marginTop: 24, marginBottom: 12 }}>Change password</div>
            <p className="page-subtitle" style={{ marginBottom: 16, marginTop: 0 }}>
              Leave blank to keep your current password.
            </p>

            <div className="form-group">
              <label htmlFor="new_password">New password</label>
              <input
                id="new_password"
                type="password"
                value={form.new_password}
                onChange={(e) => setField('new_password', e.target.value)}
                autoComplete="new-password"
              />
              <span className="form-hint">Minimum 8 characters.</span>
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password">Confirm new password</label>
              <input
                id="confirm_password"
                type="password"
                value={form.confirm_password}
                onChange={(e) => setField('confirm_password', e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {changingCredentials && (
              <div className="form-group">
                <label htmlFor="current_password">Current password</label>
                <span className="form-hint">Required to save email or password changes.</span>
                <input
                  id="current_password"
                  type="password"
                  value={form.current_password}
                  onChange={(e) => setField('current_password', e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>
      )}
    </Layout>
  );
}
