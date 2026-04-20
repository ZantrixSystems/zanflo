import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../auth-context.jsx';
import { buildApplicantNav } from '../lib/navigation.js';

// ---------------------------------------------------------------------------
// Status metadata for premise_licence_cases
// ---------------------------------------------------------------------------
const CASE_STATUS_META = {
  draft:                { label: 'Draft',              cls: 'status-draft' },
  submitted:            { label: 'Submitted',          cls: 'status-submitted' },
  under_review:         { label: 'Under review',       cls: 'status-under_review' },
  awaiting_information: { label: 'Awaiting info',      cls: 'status-awaiting_information' },
  waiting_on_officer:   { label: 'Response sent',      cls: 'status-submitted' },
  verified:             { label: 'Verified',           cls: 'status-approved' },
  under_consultation:   { label: 'Consultation',       cls: 'status-under_review' },
  licensed:             { label: 'Licensed',           cls: 'status-approved' },
  refused:              { label: 'Refused',            cls: 'status-refused' },
};

function CaseStatusBadge({ status }) {
  const meta = CASE_STATUS_META[status] ?? { label: status?.replace(/_/g, ' ') ?? '—', cls: '' };
  return <span className={`status-tag ${meta.cls}`}>{meta.label}</span>;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [premises, setPremises]   = useState([]);
  const [cases, setCases]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    Promise.all([
      api.listPremises(),
      api.listApplicantCases(),
    ])
      .then(([premisesData, casesData]) => {
        setPremises(premisesData.premises ?? []);
        setCases(casesData.cases ?? []);
      })
      .catch(() => setError('Could not load your account.'))
      .finally(() => setLoading(false));
  }, []);

  // Map case by premises_id for quick lookup
  const caseByPremises = cases.reduce((acc, c) => {
    acc[c.premises_id] = c;
    return acc;
  }, {});

  async function startCase(premisesId) {
    try {
      const data = await api.createApplicantCase({ premises_id: premisesId });
      navigate(`/cases/${data.case.id}`);
    } catch (err) {
      if (err.status === 409) {
        // Case already exists — go to it
        const existing = cases.find((c) => c.premises_id === premisesId);
        if (existing) { navigate(`/cases/${existing.id}`); return; }
      }
      setError(err.message || 'Could not create case.');
    }
  }

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
              <Link className="btn btn-primary" to="/premises/new">Add premises</Link>
            </div>
          </div>

          {/* No premises yet */}
          {premises.length === 0 && (
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-title">No premises yet</div>
              <p className="dashboard-empty-hint">
                Add a premises to start a licence application.
              </p>
              <Link className="btn btn-primary" to="/premises/new">Add your first premises</Link>
            </div>
          )}

          {/* Premises list */}
          {premises.map((row) => {
            const caseRecord = caseByPremises[row.id];
            const hasCase    = !!caseRecord;
            const isClosed   = ['licensed', 'refused'].includes(caseRecord?.status);
            const awaitingInfo = caseRecord?.status === 'awaiting_information';

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
                    {hasCase && <CaseStatusBadge status={caseRecord.status} />}
                    <div className="dashboard-premises-actions">
                      {!hasCase && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => startCase(row.id)}
                        >
                          Start application
                        </button>
                      )}
                      {hasCase && (
                        <Link to={`/cases/${caseRecord.id}`} className="btn btn-secondary btn-sm">
                          {isClosed ? 'View case' : 'Continue'}
                        </Link>
                      )}
                      <Link to={`/premises/${row.id}`} className="btn btn-secondary btn-sm">
                        Edit premises
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Guidance notices */}
                {!hasCase && (
                  <div className="dashboard-premises-notice notice-info">
                    No application yet. Start one to apply for a licence.
                  </div>
                )}

                {awaitingInfo && (
                  <div className="dashboard-premises-notice notice-warning">
                    The council has requested more information for this case.{' '}
                    <Link to={`/cases/${caseRecord.id}`} className="notice-link">Respond now</Link>
                  </div>
                )}

                {caseRecord?.status === 'licensed' && (
                  <div className="dashboard-premises-notice notice-success">
                    Licence granted. You can apply for additional sections by modifying this case.
                  </div>
                )}

                {caseRecord?.status === 'refused' && (
                  <div className="dashboard-premises-notice notice-error">
                    This application was refused. Contact the council for details. You can modify and resubmit this case.
                  </div>
                )}

                {/* Case summary row */}
                {hasCase && (
                  <div className="dashboard-applications-list">
                    <div className="dashboard-applications-label">Licence case</div>
                    <Link to={`/cases/${caseRecord.id}`} className="dashboard-application-row">
                      <div className="dashboard-application-row-left">
                        <div className="dashboard-application-type">
                          {Array.isArray(caseRecord.sections) && caseRecord.sections.length > 0
                            ? caseRecord.sections.map((s) => s.name).join(', ')
                            : 'No sections selected yet'}
                        </div>
                        <div className="dashboard-application-meta">
                          Started {formatDate(caseRecord.created_at)}
                          {caseRecord.submitted_at && ` · Submitted ${formatDate(caseRecord.submitted_at)}`}
                          {caseRecord.last_modified_at && ` · Modified ${formatDate(caseRecord.last_modified_at)}`}
                        </div>
                      </div>
                      <div className="dashboard-application-row-right">
                        <CaseStatusBadge status={caseRecord.status} />
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </Layout>
  );
}
