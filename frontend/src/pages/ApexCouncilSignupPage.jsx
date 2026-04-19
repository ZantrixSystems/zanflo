import { useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

export default function ApexCouncilSignupPage() {
  const [form, setForm] = useState({
    organisation_name: '',
    subdomain_slug: '',
    admin_full_name: '',
    admin_email: '',
    password: '',
    password_confirmation: '',
    accept_terms: false,
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const hostnamePreview = useMemo(() => {
    const slug = slugify(form.subdomain_slug || form.organisation_name);
    return slug ? `${slug}.zanflo.com` : 'your-council.zanflo.com';
  }, [form.organisation_name, form.subdomain_slug]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        ...form,
        subdomain_slug: slugify(form.subdomain_slug || form.organisation_name),
      };
      const data = await api.platformSignup(payload);
      setNotice(`Tenant created. Redirecting you to ${data.tenant.hostname}...`);
      window.location.href = data.bootstrap_redirect;
    } catch (err) {
      setError(err.message || 'Could not create your council workspace.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <section className="form-section">
        <div className="form-section-title">Council self-service setup</div>
        <h1 className="page-title">Create your council workspace</h1>
        <p className="page-subtitle">
          This creates your council&apos;s own Zanflo site, your first tenant admin account, and the public applicant homepage for your council.
        </p>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="form-section">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="organisation_name">Organisation or council name</label>
            <input
              id="organisation_name"
              value={form.organisation_name}
              onChange={(event) => setField('organisation_name', event.target.value)}
              placeholder="Riverside Council"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="subdomain_slug">Council subdomain</label>
            <div className="subdomain-input-row">
              <input
                id="subdomain_slug"
                value={form.subdomain_slug}
                onChange={(event) => setField('subdomain_slug', slugify(event.target.value))}
                placeholder="riverside"
                autoComplete="off"
                required
              />
              <span className="subdomain-suffix">.zanflo.com</span>
            </div>
            <span className="form-hint">
              Your council will get its own secure address, for example <strong>{hostnamePreview}</strong>. Your staff and applicants will use this council specific site.
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="admin_full_name">Bootstrap admin full name</label>
            <input
              id="admin_full_name"
              value={form.admin_full_name}
              onChange={(event) => setField('admin_full_name', event.target.value)}
              placeholder="Alex Morgan"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin_email">Bootstrap admin email</label>
            <input
              id="admin_email"
              type="email"
              value={form.admin_email}
              onChange={(event) => setField('admin_email', event.target.value)}
              placeholder="licensing.admin@riverside.gov.uk"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Bootstrap password</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(event) => setField('password', event.target.value)}
              autoComplete="new-password"
              required
            />
            <span className="form-hint">
              This is your high-privilege local break glass account for first setup and emergency access. Use at least 8 characters, including an uppercase letter and a number.
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="password_confirmation">Confirm bootstrap password</label>
            <input
              id="password_confirmation"
              type="password"
              value={form.password_confirmation}
              onChange={(event) => setField('password_confirmation', event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <label className="checkbox-row" htmlFor="accept_terms">
            <input
              id="accept_terms"
              type="checkbox"
              checked={form.accept_terms}
              onChange={(event) => setField('accept_terms', event.target.checked)}
            />
            <span>I understand this creates a live council workspace and a high-privilege bootstrap admin account.</span>
          </label>

          <div className="platform-hero-actions" style={{ marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating council workspace...' : 'Create council workspace'}
            </button>
            <a className="btn btn-secondary" href="/council-sign-in">
              Already have a council site?
            </a>
          </div>
        </form>
      </section>
    </Layout>
  );
}
