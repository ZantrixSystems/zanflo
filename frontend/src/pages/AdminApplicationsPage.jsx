import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { useStaffAuth } from '../components/RequireStaffAuth.jsx';
import { buildTenantAdminNav } from '../lib/navigation.js';

const STATUS_META = {
  submitted:            { label: 'Submitted',           cls: 'badge-submitted' },
  under_review:         { label: 'Under review',        cls: 'badge-under-review' },
  awaiting_information: { label: 'Awaiting information', cls: 'badge-awaiting' },
  approved:             { label: 'Approved',            cls: 'badge-approved' },
  refused:              { label: 'Refused',             cls: 'badge-refused' },
  draft:                { label: 'Draft',               cls: 'badge-draft' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status?.replace(/_/g, ' ') ?? 'Unknown', cls: 'badge-draft' };
  return <span className={`status-badge ${meta.cls}`}>{meta.label}</span>;
}

function formatShortDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function AdminApplicationsPage() {
  const { session, logout } = useStaffAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMine, setViewMine] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api.listAdminApplications({
      status: status || undefined,
      assigned: viewMine ? 'mine' : undefined,
    })
      .then((data) => { if (active) setApplications(data.applications ?? []); })
      .catch((err) => { if (active) setError(err.message || 'Could not load applications.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [status, viewMine]);

  return (
    <Layout
      session={session}
      onSignOut={logout}
      brandTarget="/admin/dashboard"
      signOutTarget="/admin"
      breadcrumbs={[
        { to: '/admin/dashboard', label: 'Dashboard' },
        { label: 'Applications' },
      ]}
      navItems={buildTenantAdminNav(session)}
    >
      <section className="form-section">
        <h1 className="page-title">Applications</h1>
        <p className="page-subtitle">
          Review submitted applications and manage your case queue.
        </p>
      </section>

      <div className="queue-toolbar">
        <div className="queue-view-toggle">
          <button
            type="button"
            className={`queue-toggle-btn${viewMine ? ' active' : ''}`}
            onClick={() => setViewMine(true)}
          >
            My cases
          </button>
          <button
            type="button"
            className={`queue-toggle-btn${!viewMine ? ' active' : ''}`}
            onClick={() => setViewMine(false)}
          >
            All cases
          </button>
        </div>

        <select
          className="queue-status-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under review</option>
          <option value="awaiting_information">Awaiting information</option>
          <option value="approved">Approved</option>
          <option value="refused">Refused</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : applications.length === 0 ? (
        <div className="queue-empty">
          <div className="queue-empty-title">
            {viewMine ? 'No cases assigned to you' : 'No applications match this filter'}
          </div>
          {viewMine && (
            <p className="queue-empty-hint">
              <button type="button" className="link-btn" onClick={() => setViewMine(false)}>
                View all unassigned cases
              </button>{' '}
              to pick one up.
            </p>
          )}
        </div>
      ) : (
        <div className="queue-list">
          {applications.map((app) => (
            <Link
              key={app.id}
              className="queue-row"
              to={`/admin/applications/${app.id}`}
            >
              <div className="queue-row-main">
                <div className="queue-row-title">
                  {app.premises_name || app.application_type_name || 'Application'}
                </div>
                <div className="queue-row-sub">
                  {app.application_type_name}
                  {app.premises_postcode && <span className="queue-row-postcode">{app.premises_postcode}</span>}
                </div>
                <div className="queue-row-applicant">
                  {app.applicant_name || app.applicant_email || 'Unknown applicant'}
                </div>
              </div>
              <div className="queue-row-aside">
                <StatusBadge status={app.status} />
                <div className="queue-row-meta-row">
                  {app.submitted_at && (
                    <span className="queue-row-date">Submitted {formatShortDate(app.submitted_at)}</span>
                  )}
                </div>
                <div className="queue-row-assignment">
                  {app.assigned_user_id === session.user_id
                    ? <span className="queue-assigned-me">Assigned to you</span>
                    : app.assigned_user_name
                      ? <span className="queue-assigned-other">{app.assigned_user_name}</span>
                      : <span className="queue-unassigned">Unassigned</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
