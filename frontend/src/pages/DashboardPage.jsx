import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../auth-context.jsx';
import { buildApplicantNav } from '../lib/navigation.js';

// Statuses that mean something is actively happening — show in "In progress"
const ACTIVE_STATUSES = new Set([
  'draft',
  'submitted',
  'under_review',
  'returned_to_applicant',
  'awaiting_information',
  'waiting_on_officer',
  'under_consultation',
]);

const STATUS_META = {
  draft:                  { label: 'Draft',              cls: 'appl-status-draft',     needsAction: true },
  submitted:              { label: 'Submitted',          cls: 'appl-status-submitted',  needsAction: false },
  under_review:           { label: 'Under review',       cls: 'appl-status-review',     needsAction: false },
  returned_to_applicant:  { label: 'Returned to you',   cls: 'appl-status-returned',   needsAction: true },
  awaiting_information:   { label: 'Info requested',     cls: 'appl-status-info',       needsAction: true },
  waiting_on_officer:     { label: 'Response sent',      cls: 'appl-status-submitted',  needsAction: false },
  verified:               { label: 'Verified',           cls: 'appl-status-approved',   needsAction: false },
  under_consultation:     { label: 'Consultation',       cls: 'appl-status-review',     needsAction: false },
  licensed:               { label: 'Licensed',           cls: 'appl-status-approved',   needsAction: false },
  refused:                { label: 'Refused',            cls: 'appl-status-refused',    needsAction: false },
};

const NOTICE_TEXT = {
  draft:                 'Finish filling in your case and submit it when ready.',
  submitted:             'Your case has been submitted. The council will pick it up shortly.',
  under_review:          'The licensing team is reviewing your case.',
  returned_to_applicant: 'The officer has returned this case with comments. Please review and resubmit.',
  awaiting_information:  'The council needs more information from you before they can continue.',
  waiting_on_officer:    'Your response has been sent. Waiting for the officer to review.',
  under_consultation:    'Your case is in the consultation stage.',
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label: status?.replace(/_/g, ' ') ?? '—', cls: '' };
  return <span className={`appl-status-badge ${m.cls}`}>{m.label}</span>;
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DashboardPage() {
  const { session } = useAuth();
  const [cases, setCases]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.listApplicantCases()
      .then((d) => setCases(d.cases ?? []))
      .catch(() => setError('Could not load your cases.'))
      .finally(() => setLoading(false));
  }, []);

  const activeCases = cases.filter((c) => ACTIVE_STATUSES.has(c.status));
  const firstName   = session?.full_name?.split(' ')[0] ?? null;

  return (
    <Layout
      breadcrumbs={[
        { to: '/', label: 'Home' },
        { label: 'In progress' },
      ]}
      navItems={buildApplicantNav(session)}
    >
      <div className="appl-page-header">
        <div>
          <h1 className="appl-page-title">
            {firstName ? `In progress — ${firstName}` : 'In progress'}
          </h1>
          <p className="appl-page-subtitle">
            Cases that are active or need your attention. Licensed and closed cases appear on your premises page.
          </p>
        </div>
        <Link className="btn btn-secondary" to="/premises">All premises</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner">Loading…</div>
      ) : activeCases.length === 0 ? (
        <div className="appl-empty">
          <div className="appl-empty-icon">✅</div>
          <div className="appl-empty-title">Nothing in progress</div>
          <p className="appl-empty-hint">
            You have no active cases right now. Visit your premises to start a new application or view completed ones.
          </p>
          <Link className="btn btn-primary" to="/premises">Go to premises</Link>
        </div>
      ) : (
        <div className="appl-premises-list">
          {activeCases.map((c) => {
            const meta       = STATUS_META[c.status] ?? STATUS_META.draft;
            const noticeText = NOTICE_TEXT[c.status];
            const sections   = Array.isArray(c.sections) && c.sections.length > 0
              ? c.sections.map((s) => s.name).join(' · ')
              : null;

            return (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className={`appl-inprogress-card${meta.needsAction ? ' appl-inprogress-card--action' : ''}`}
              >
                <div className="appl-inprogress-top">
                  <div className="appl-inprogress-premises">{c.premises_name}</div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="appl-inprogress-address">
                  {[c.address_line_1, c.postcode].filter(Boolean).join(', ')}
                </div>

                {sections && (
                  <div className="appl-inprogress-sections">{sections}</div>
                )}

                {noticeText && (
                  <div className={`appl-inprogress-notice${meta.needsAction ? ' appl-inprogress-notice--action' : ''}`}>
                    {noticeText}
                    {meta.needsAction && <span className="appl-inprogress-cta">Open →</span>}
                  </div>
                )}

                <div className="appl-case-meta">
                  {formatDate(c.created_at) && <span>Started {formatDate(c.created_at)}</span>}
                  {c.submitted_at && <span>Submitted {formatDate(c.submitted_at)}</span>}
                  {c.last_modified_at && <span>Updated {formatDate(c.last_modified_at)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
