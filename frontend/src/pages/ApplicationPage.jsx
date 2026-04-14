/**
 * Application general form page.
 *
 * Three sections:
 *   1. Applicant details (who is applying)
 *   2. Premises details (what/where is being licensed)
 *   3. Contact details (who the council should contact — may differ from applicant)
 *
 * Design decisions:
 * - Single-page, section-based (not a multi-step wizard).
 *   Reason: the general form is short enough that all sections fit comfortably
 *   on one page. The applicant can see the full scope at a glance.
 *   A stepper would add navigation complexity for no UX gain at this scope.
 *
 * - Auto-save is NOT implemented. Explicit "Save draft" button only.
 *   Reason: auto-save requires debounce + conflict handling + optimistic UI.
 *   That is worth doing in a later iteration. Explicit save is safe and honest.
 *
 * - Submit is a separate action with a visible confirmation.
 *   Once submitted, the form becomes read-only.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// Fields that are part of the form — maps to the backend schema
const FORM_FIELDS = [
  'applicant_name', 'applicant_email', 'applicant_phone',
  'premises_name', 'premises_address', 'premises_postcode', 'premises_description',
  'contact_name', 'contact_email', 'contact_phone',
];

export default function ApplicationPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [formData,    setFormData]     = useState({});
  const [loading,     setLoading]      = useState(true);
  const [saving,      setSaving]       = useState(false);
  const [submitting,  setSubmitting]   = useState(false);
  const [saveStatus,  setSaveStatus]   = useState(''); // '' | 'saved' | 'error'
  const [error,       setError]        = useState('');

  // Load application
  useEffect(() => {
    api.getApplication(id)
      .then((app) => {
        setApplication(app);
        // Populate form with existing data
        const fields = {};
        FORM_FIELDS.forEach((f) => { fields[f] = app[f] ?? ''; });
        setFormData(fields);
      })
      .catch((err) => {
        if (err.status === 404) navigate('/dashboard');
        else setError('Could not load application.');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const isDraft = application?.status === 'draft';

  function set(field) {
    return (e) => setFormData((f) => ({ ...f, [field]: e.target.value }));
  }

  // Save draft — sends only non-empty changes (backend handles partial updates)
  const saveDraft = useCallback(async () => {
    if (!isDraft) return;
    setSaving(true);
    setSaveStatus('');
    setError('');

    // Convert empty strings to null for clean storage
    const payload = {};
    FORM_FIELDS.forEach((f) => {
      payload[f] = formData[f]?.trim() || null;
    });

    try {
      const updated = await api.updateApplication(id, payload);
      setApplication(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setError(err.message || 'Save failed.');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [id, formData, isDraft]);

  async function handleSubmit() {
    if (!isDraft) return;
    // Save first, then submit
    setSaving(true);
    setError('');

    const payload = {};
    FORM_FIELDS.forEach((f) => {
      payload[f] = formData[f]?.trim() || null;
    });

    try {
      await api.updateApplication(id, payload);
      setSubmitting(true);
      const submitted = await api.submitApplication(id);
      setApplication(submitted);
      setSaveStatus('');
    } catch (err) {
      setError(err.message || 'Submission failed.');
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="spinner">Loading…</div>
      </Layout>
    );
  }

  if (!application) return null;

  const isReadOnly = application.status !== 'draft';

  return (
    <Layout>
      <Link to="/dashboard" className="back-link">
        ← Back to dashboard
      </Link>

      <div className="form-page-header">
        <span className="form-page-type-label">
          {application.application_type_name || 'Application'}
        </span>
        <h1 className="form-page-title">
          {application.premises_name
            ? `Application — ${application.premises_name}`
            : 'New application'}
        </h1>
        <p className="form-page-status">
          {isReadOnly
            ? `Submitted ${formatDate(application.submitted_at)}`
            : `Draft · last saved ${formatDate(application.updated_at)}`}
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {isReadOnly && (
        <div className="alert alert-success" style={{ marginBottom: 24 }}>
          This application has been submitted. It cannot be edited.
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()}>

        {/* ── Section 1: Applicant details ── */}
        <section className="form-section">
          <h2 className="form-section-title">Applicant details</h2>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            The person or organisation applying for the licence.
          </p>

          <div className="form-group">
            <label htmlFor="applicant_name">
              Full name or organisation name <Required />
            </label>
            <input
              id="applicant_name"
              type="text"
              value={formData.applicant_name}
              onChange={set('applicant_name')}
              disabled={isReadOnly}
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="applicant_email">
              Email address <Required />
            </label>
            <input
              id="applicant_email"
              type="email"
              value={formData.applicant_email}
              onChange={set('applicant_email')}
              disabled={isReadOnly}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="applicant_phone">
              Phone number <Optional />
            </label>
            <input
              id="applicant_phone"
              type="tel"
              value={formData.applicant_phone}
              onChange={set('applicant_phone')}
              disabled={isReadOnly}
              autoComplete="tel"
            />
          </div>
        </section>

        {/* ── Section 2: Premises details ── */}
        <section className="form-section">
          <h2 className="form-section-title">Premises details</h2>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            The premises to be licensed.
          </p>

          <div className="form-group">
            <label htmlFor="premises_name">
              Premises name <Required />
            </label>
            <input
              id="premises_name"
              type="text"
              value={formData.premises_name}
              onChange={set('premises_name')}
              disabled={isReadOnly}
            />
          </div>

          <div className="form-group">
            <label htmlFor="premises_address">
              Address <Required />
            </label>
            <textarea
              id="premises_address"
              value={formData.premises_address}
              onChange={set('premises_address')}
              disabled={isReadOnly}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="premises_postcode">
              Postcode <Required />
            </label>
            <input
              id="premises_postcode"
              type="text"
              value={formData.premises_postcode}
              onChange={set('premises_postcode')}
              disabled={isReadOnly}
              style={{ maxWidth: 160 }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="premises_description">
              Description of premises <Optional />
            </label>
            <textarea
              id="premises_description"
              value={formData.premises_description}
              onChange={set('premises_description')}
              disabled={isReadOnly}
              rows={3}
            />
            <span className="form-hint">
              Brief description — e.g. type of venue, capacity, planned activities.
            </span>
          </div>
        </section>

        {/* ── Section 3: Contact details ── */}
        <section className="form-section">
          <h2 className="form-section-title">Contact details</h2>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            The person the council should contact about this application.
            This may be a solicitor, agent, or the applicant themselves.
          </p>

          <div className="form-group">
            <label htmlFor="contact_name">
              Contact name <Optional />
            </label>
            <input
              id="contact_name"
              type="text"
              value={formData.contact_name}
              onChange={set('contact_name')}
              disabled={isReadOnly}
            />
          </div>

          <div className="form-group">
            <label htmlFor="contact_email">
              Contact email <Optional />
            </label>
            <input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={set('contact_email')}
              disabled={isReadOnly}
            />
          </div>

          <div className="form-group">
            <label htmlFor="contact_phone">
              Contact phone <Optional />
            </label>
            <input
              id="contact_phone"
              type="tel"
              value={formData.contact_phone}
              onChange={set('contact_phone')}
              disabled={isReadOnly}
            />
          </div>
        </section>

        {/* ── Actions ── */}
        {!isReadOnly && (
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveDraft}
              disabled={saving || submitting}
            >
              {saving && !submitting ? 'Saving…' : 'Save draft'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSubmit}
              disabled={saving || submitting}
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>

            {saveStatus === 'saved' && (
              <span className="save-indicator saved">Saved</span>
            )}
          </div>
        )}
      </form>
    </Layout>
  );
}

function Required() {
  return (
    <span
      aria-label="required"
      title="Required to submit"
      style={{ color: 'var(--color-danger)', marginLeft: 2 }}
    >
      *
    </span>
  );
}

function Optional() {
  return (
    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 4 }}>
      (optional)
    </span>
  );
}
