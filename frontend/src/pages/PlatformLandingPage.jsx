import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';

const initialForm = {
  organisation_name: '',
  contact_name: '',
  work_email: '',
  requested_subdomain: '',
  message: '',
};

export default function PlatformLandingPage() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === 'requested_subdomain' ? value.toLowerCase() : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const response = await api.requestAccess(form);
      setSuccess(response.message || 'Request received.');
      setForm(initialForm);
    } catch (err) {
      setError(err.message || 'Could not send request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="platform-hero">
        <div className="platform-hero-copy">
          <div className="section-heading">Council Licensing Platform</div>
          <h1 className="page-title platform-hero-title">
            Multi-tenant licensing for councils, built for controlled rollout.
          </h1>
          <p className="page-subtitle platform-hero-subtitle">
            ZanFlo gives councils a tenant-specific portal for applicants and staff,
            while keeping onboarding, governance, and platform administration under central control.
          </p>
          <div className="platform-hero-actions">
            <a className="btn btn-primary" href="#request-access">Request access</a>
            <a className="btn btn-secondary" href="#existing-users">Already using ZanFlo?</a>
          </div>
        </div>

        <div className="platform-hero-panel form-section">
          <div className="form-section-title">URL Strategy</div>
          <div className="platform-url-list">
            <div className="platform-url-item">
              <strong>zanflo.com</strong>
              <span>Platform landing page and council onboarding entry point.</span>
            </div>
            <div className="platform-url-item">
              <strong>platform.zanflo.com</strong>
              <span>Internal platform administration area.</span>
            </div>
            <div className="platform-url-item">
              <strong>&lt;tenant&gt;.zanflo.com</strong>
              <span>Tenant-specific portal for applicants and council staff.</span>
            </div>
          </div>
        </div>
      </div>

      <section className="form-section">
        <div className="form-section-title">What It Is</div>
        <div className="platform-two-column">
          <p className="platform-body-copy">
            ZanFlo is a shared licensing platform for councils and similar public-sector organisations.
            Each council operates within its own tenant boundary, with separate data, users, and public-facing hostname.
          </p>
          <p className="platform-body-copy">
            The platform is designed for operational clarity: applicants submit online, staff process cases inside a fixed workflow,
            and platform-level onboarding remains deliberate rather than self-provisioned.
          </p>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-title">Key Benefits</div>
        <div className="platform-feature-grid">
          <article className="platform-feature-card">
            <h2>Tenant isolation from day one</h2>
            <p>Each council runs independently on the same platform without data leakage across tenants.</p>
          </article>
          <article className="platform-feature-card">
            <h2>Operationally practical</h2>
            <p>Application flows stay simple for the public and efficient for officers reviewing live casework.</p>
          </article>
          <article className="platform-feature-card">
            <h2>Controlled onboarding</h2>
            <p>New councils request access centrally first, so rollout, validation, and domain allocation stay governed.</p>
          </article>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-title">How It Works</div>
        <div className="platform-steps">
          <div className="platform-step">
            <span className="platform-step-number">01</span>
            <div>
              <h2>Council requests access</h2>
              <p>A council submits an onboarding request with its organisation details and preferred subdomain.</p>
            </div>
          </div>
          <div className="platform-step">
            <span className="platform-step-number">02</span>
            <div>
              <h2>ZanFlo reviews and prepares the tenant</h2>
              <p>The platform team validates the request, provisions the tenant manually, and assigns the first admin safely.</p>
            </div>
          </div>
          <div className="platform-step">
            <span className="platform-step-number">03</span>
            <div>
              <h2>The council operates on its own hostname</h2>
              <p>Applicants and tenant staff use the council’s dedicated subdomain rather than the platform apex domain.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="form-section" id="request-access">
        <div className="form-section-title">Request Access</div>
        <div className="platform-request-grid">
          <div>
            <h2 className="platform-section-heading">Start a controlled onboarding request</h2>
            <p className="platform-body-copy">
              This request does not create a tenant automatically. It opens a platform review step so the council,
              subdomain, and initial operating setup can be checked before activation.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="form-group">
              <label htmlFor="organisation_name">Organisation name</label>
              <input
                id="organisation_name"
                value={form.organisation_name}
                onChange={(event) => update('organisation_name', event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="contact_name">Contact name</label>
              <input
                id="contact_name"
                value={form.contact_name}
                onChange={(event) => update('contact_name', event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="work_email">Work email</label>
              <input
                id="work_email"
                type="email"
                value={form.work_email}
                onChange={(event) => update('work_email', event.target.value)}
                autoComplete="email"
                required
              />
              <div className="form-hint">Use a council or organisational email address, not a personal mailbox.</div>
            </div>

            <div className="form-group">
              <label htmlFor="requested_subdomain">Requested subdomain</label>
              <input
                id="requested_subdomain"
                value={form.requested_subdomain}
                onChange={(event) => update('requested_subdomain', event.target.value.replace(/\s+/g, ''))}
                required
              />
              <div className="form-hint">Example: `northbridge` for `northbridge.zanflo.com`</div>
            </div>

            <div className="form-group">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                value={form.message}
                onChange={(event) => update('message', event.target.value)}
              />
              <div className="form-hint">Optional context such as rollout timing, licence type, or internal sponsor.</div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                submitting ||
                !form.organisation_name ||
                !form.contact_name ||
                !form.work_email ||
                !form.requested_subdomain
              }
            >
              {submitting ? 'Sending request…' : 'Request access'}
            </button>
          </form>
        </div>
      </section>

      <section className="form-section" id="existing-users">
        <div className="form-section-title">Existing Users</div>
        <div className="platform-guidance-grid">
          <article className="platform-guidance-card">
            <h2>Council applicants and tenant staff</h2>
            <p>Use your council’s dedicated subdomain, not the platform root domain.</p>
          </article>
          <article className="platform-guidance-card">
            <h2>Platform administrators</h2>
            <p>Use `platform.zanflo.com` for internal platform administration once your access has been issued.</p>
          </article>
        </div>
      </section>
    </Layout>
  );
}
