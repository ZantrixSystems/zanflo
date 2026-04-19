import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../auth-context.jsx';
import { buildApplicantNav } from '../lib/navigation.js';

const VERIFICATION_META = {
  unverified:                { label: 'Not submitted',   cls: 'status-verification-unverified' },
  pending_verification:      { label: 'Awaiting review', cls: 'status-verification-pending-verification' },
  verified:                  { label: 'Verified',        cls: 'status-verification-verified' },
  verification_refused:      { label: 'Refused',         cls: 'status-verification-verification-refused' },
  more_information_required: { label: 'Info required',   cls: 'status-verification-more-information-required' },
};

const APP_STATUS_META = {
  draft:                { label: 'Draft',           cls: 'status-draft' },
  submitted:            { label: 'Submitted',       cls: 'status-submitted' },
  under_review:         { label: 'Under review',    cls: 'status-under_review' },
  awaiting_information: { label: 'Awaiting info',   cls: 'status-awaiting_information' },
  approved:             { label: 'Approved',        cls: 'status-approved' },
  refused:              { label: 'Refused',         cls: 'status-refused' },
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function VerificationBadge({ state }) {
  const meta = VERIFICATION_META[state] ?? { label: state?.replace(/_/g, ' ') ?? 'Unknown', cls: '' };
  return <span className={`status-tag ${meta.cls}`}>{meta.label}</span>;
}

function AppStatusBadge({ status }) {
  const meta = APP_STATUS_META[status] ?? { label: status?.replace(/_/g, ' ') ?? '—', cls: '' };
  return <span className={`status-tag ${meta.cls}`}>{meta.label}</span>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [premises, setPremises] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    Promise.all([
      api.listPremises(),
      api.listApplications(),
    ])
      .then(([premisesData, appsData]) => {
        setPremises(premisesData.premises ?? []);
        setApplications(appsData.applications ?? []);
      })
      .catch(() => setError('Could not load your account.'))
      .finally(() => setLoading(false));
  }, []);

  async function deleteDraft(e, appId) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setDeleting(appId);
    try {
      await api.deleteApplication(appId);
      setApplications((prev) => prev.filter((a) => a.id !== appId));
    } catch (err) {
      setError(err.message || 'Could not delete draft.');
    } finally {
      setDeleting(null);
    }
  }

  // Group applications by premises_id
  const appsByPremises = applications.reduce((acc, app) => {
    const key = app.premises_id || '__no_premises__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(app);
    return acc;
  }, {});

  // Applications with no premises link (edge case)
  const orphanApps = appsByPremises['__no_premises__'] ?? [];

  return (
    <Layout
      breadcrumbs={[
        { to: '/', label: 'Applicant portal' },
        { label: 'My account' },
      ]}
      navItems={buildApplicantNav(session)}
    >
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : (
        <>
          {/* Page header */}
          <div className="dashboard-page-header">
            <div>
              <h1 className="dashboard-page-title">
                {session?.full_name ? `Welcome, ${session.full_name.split(' ')[0]}` : 'Your account'}
              </h1>
              <p className="dashboard-page-subtitle">
                Manage your premises and licence applications.
              </p>
            </div>
            <div className="dashboard-header-actions">
              <Link className="btn btn-secondary" to="/premises/new">Add premises</Link>
              <Link className="btn btn-primary" to="/apply">Start application</Link>
            </div>
          </div>

          {/* No premises at all */}
          {premises.length === 0 && (
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-title">No premises yet</div>
              <p className="dashboard-empty-hint">
                Add your premises first. Once the council has verified it, you can start licence applications.
              </p>
              <Link className="btn btn-primary" to="/premises/new">Add your first premises</Link>
            </div>
          )}

          {/* Premises list — each card shows verification + linked applications */}
          {premises.map((row) => {
            const linkedApps = appsByPremises[row.id] ?? [];
            const isVerified = row.verification_state === 'verified';
            const canApply = isVerified;

            return (
              <div key={row.id} className="dashboard-premises-card">
                {/* Premises header */}
                <div className="dashboard-premises-header">
                  <div className="dashboard-premises-header-left">
                    <div className="dashboard-premises-name">
                      <Link to={`/premises/${row.id}`} className="dashboard-premises-name-link">
                        {row.premises_name}
                      </Link>
                    </div>
                    <div className="dashboard-premises-address">
                      {[row.address_line_1, row.town_or_city, row.postcode].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <div className="dashboard-premises-header-right">
                    <VerificationBadge state={row.verification_state} />
                    <div className="dashboard-premises-actions">
                      {canApply && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/apply?premises=${row.id}`)}
                        >
                          New application
                        </button>
                      )}
                      <Link to={`/premises/${row.id}`} className="btn btn-secondary btn-sm">
                        Manage
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Verification guidance — shown when not yet verified */}
                {row.verification_state === 'unverified' && (
                  <div className="dashboard-premises-notice notice-info">
                    Submit this premises for council verification before you can apply for licences.
                    <Link to={`/premises/${row.id}`} className="notice-link">Submit for verification</Link>
                  </div>
                )}
                {row.verification_state === 'pending_verification' && (
                  <div className="dashboard-premises-notice notice-pending">
                    Your verification request is being reviewed by the council.
                  </div>
                )}
                {row.verification_state === 'more_information_required' && (
                  <div className="dashboard-premises-notice notice-warning">
                    The council has requested more information before this premises can be verified.
                    <Link to={`/premises/${row.id}`} className="notice-link">Respond now</Link>
                  </div>
                )}
                {row.verification_state === 'verification_refused' && (
                  <div className="dashboard-premises-notice notice-error">
                    Verification for this premises was refused. Contact the council for details.
                  </div>
                )}

                {/* Linked applications */}
                {linkedApps.length > 0 ? (
                  <div className="dashboard-applications-list">
                    <div className="dashboard-applications-label">Applications</div>
                    {linkedApps.map((app) => (
                      <Link
                        key={app.id}
                        to={`/applications/${app.id}`}
                        className="dashboard-application-row"
                      >
                        <div className="dashboard-application-row-left">
                          <div className="dashboard-application-type">{app.application_type_name}</div>
                          <div className="dashboard-application-meta">
                            Started {formatDate(app.created_at)}
                            {app.submitted_at && ` · Submitted ${formatDate(app.submitted_at)}`}
                            {app.status === 'draft' && app.expires_at && (
                              <span className="draft-expiry-warning">
                                {' '}· Expires {formatDate(app.expires_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="dashboard-application-row-right">
                          <AppStatusBadge status={app.status} />
                          {app.status === 'draft' && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={(e) => deleteDraft(e, app.id)}
                              disabled={deleting === app.id}
                            >
                              {deleting === app.id ? '…' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : isVerified ? (
                  <div className="dashboard-applications-empty">
                    No applications yet against this premises.
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => navigate(`/apply?premises=${row.id}`)}
                    >
                      Start one now
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Orphan applications (no premises link — should not normally exist) */}
          {orphanApps.length > 0 && (
            <div className="dashboard-premises-card">
              <div className="dashboard-premises-header">
                <div className="dashboard-premises-name">Other applications</div>
              </div>
              <div className="dashboard-applications-list">
                {orphanApps.map((app) => (
                  <Link key={app.id} to={`/applications/${app.id}`} className="dashboard-application-row">
                    <div className="dashboard-application-row-left">
                      <div className="dashboard-application-type">
                        {app.premises_name ? `${app.premises_name} — ` : ''}{app.application_type_name}
                      </div>
                      <div className="dashboard-application-meta">Started {formatDate(app.created_at)}</div>
                    </div>
                    <div className="dashboard-application-row-right">
                      <AppStatusBadge status={app.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
