import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../auth-context.jsx';
import { buildApplicantNav } from '../lib/navigation.js';

function statusLabel(status) {
  return status.replace(/_/g, ' ');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    api.listApplications()
      .then((d) => setApplications(d.applications))
      .catch(() => setError('Could not load your applications.'))
      .finally(() => setLoadingApps(false));
  }, []);

  async function deleteDraft(e, appId) {
    e.preventDefault();
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

  return (
    <Layout
      breadcrumbs={[
        { to: '/', label: 'Applicant portal' },
        { label: 'My applications' },
      ]}
      navItems={buildApplicantNav(session)}
    >
      {error && <div className="alert alert-error">{error}</div>}

      {loadingApps ? (
        <div className="spinner">Loading...</div>
      ) : (
        <div style={{ marginBottom: 40 }}>
          <h2 className="section-heading">Your applications</h2>
          <div className="platform-hero-actions" style={{ marginBottom: 24 }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/apply')}>
              Start a new application
            </button>
          </div>
          {applications.length === 0 ? (
            <p className="empty-state">
              You have not started any applications yet.
            </p>
          ) : (
            <div className="application-list">
              {applications.map((app) => (
                <Link
                  key={app.id}
                  to={`/applications/${app.id}`}
                  className="application-row"
                >
                  <div className="application-row-main">
                    <div className="application-row-title">
                      {app.premises_name || 'Unnamed premises'} - {app.application_type_name}
                    </div>
                    <div className="application-row-meta">
                      Started {formatDate(app.created_at)}
                      {app.submitted_at && ` · Submitted ${formatDate(app.submitted_at)}`}
                      {app.status === 'draft' && app.expires_at && (
                        <span className="draft-expiry-warning">
                          {' '}· Will be deleted on {formatDate(app.expires_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`status-tag status-${app.status}`}>
                    {statusLabel(app.status)}
                  </span>
                  {app.status === 'draft' && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => deleteDraft(e, app.id)}
                      disabled={deleting === app.id}
                      style={{ marginLeft: 12 }}
                    >
                      {deleting === app.id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
