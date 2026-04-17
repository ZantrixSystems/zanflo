import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { useStaffAuth } from '../components/RequireStaffAuth.jsx';

function labelStatus(status) {
  return status?.replaceAll('_', ' ') || 'unknown';
}

export default function AdminApplicationsPage() {
  const { session, logout } = useStaffAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [assigned, setAssigned] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api.listAdminApplications({ status: status || undefined, assigned: assigned || undefined })
      .then((data) => {
        if (!active) return;
        setApplications(data.applications ?? []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Could not load applications.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [status, assigned]);

  return (
    <Layout session={session} onSignOut={logout} brandTarget="/admin/dashboard" signOutTarget="/admin">
      <section className="form-section">
        <div className="form-section-title">Application review queue</div>
        <h1 className="page-title">Applications</h1>
        <p className="page-subtitle">
          Submitted and in-progress applications for this tenant only.
        </p>

        <div className="platform-hero-actions" style={{ marginTop: 16 }}>
          <label className="form-group" style={{ minWidth: 220 }}>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All states</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under review</option>
              <option value="awaiting_information">Awaiting information</option>
              <option value="approved">Approved</option>
              <option value="refused">Refused</option>
            </select>
          </label>

          <label className="form-group" style={{ minWidth: 220 }}>
            <span>Assignment</span>
            <select value={assigned} onChange={(event) => setAssigned(event.target.value)}>
              <option value="">All assignments</option>
              <option value="mine">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </label>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="form-section">
        <div className="form-section-title">Queue</div>
        {loading ? (
          <div className="spinner">Loading...</div>
        ) : applications.length === 0 ? (
          <p className="empty-state">No applications match the current filter.</p>
        ) : (
          <div className="application-list">
            {applications.map((application) => (
              <Link
                key={application.id}
                className="application-row"
                to={`/admin/applications/${application.id}`}
              >
                <div className="application-row-main">
                  <div className="application-row-title">
                    {application.premises_name || application.application_type_name || 'Application'}
                  </div>
                  <div className="application-row-meta">
                    {labelStatus(application.status)} | {application.application_type_name}
                  </div>
                  <div className="application-row-meta">
                    Applicant: {application.applicant_name || application.applicant_email}
                  </div>
                  <div className="application-row-meta">
                    Assigned: {application.assigned_user_name || 'Unassigned'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
