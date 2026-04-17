import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';
import { useStaffAuth } from '../components/RequireStaffAuth.jsx';

function formatDate(value) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString('en-GB');
}

export default function AdminApplicationDetailPage() {
  const { id } = useParams();
  const { session, logout } = useStaffAuth();
  const [application, setApplication] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  async function loadDetail() {
    const data = await api.getAdminApplication(id);
    setApplication(data.application);
    setDecisions(data.decisions ?? []);
  }

  useEffect(() => {
    let active = true;

    loadDetail()
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Could not load application.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function runAction(action) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (action === 'assign') {
        await api.assignAdminApplication(id, { assigned_user_id: session.user_id });
        setNotice('Application assigned to you.');
      } else if (action === 'request_information') {
        await api.requestAdminApplicationInformation(id, { notes });
        setNotice('Information request recorded.');
      } else if (action === 'approve') {
        await api.decideAdminApplication(id, { decision: 'approve', notes });
        setNotice('Application approved.');
      } else if (action === 'refuse') {
        await api.decideAdminApplication(id, { decision: 'refuse', notes });
        setNotice('Application refused.');
      }

      setNotes('');
      await loadDetail();
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout session={session} onSignOut={logout} brandTarget="/admin/dashboard" signOutTarget="/admin">
      <Link to="/admin/applications" className="back-link">
        Back to applications
      </Link>

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : !application ? (
        <div className="alert alert-error">Application not found.</div>
      ) : (
        <>
          <section className="form-section">
            <div className="form-section-title">Application review</div>
            <h1 className="page-title">
              {application.premises_name || application.application_type_name || 'Application'}
            </h1>
            <p className="page-subtitle">
              Status: <strong>{application.status.replaceAll('_', ' ')}</strong>
            </p>
            <p className="platform-body-copy">
              Applicant: <strong>{application.applicant_account_name || application.applicant_account_email || application.contact_name || application.contact_email}</strong>
            </p>
            <p className="platform-body-copy">
              Assigned to: <strong>{application.assigned_user_name || 'Unassigned'}</strong>
            </p>
          </section>

          {error && <div className="alert alert-error">{error}</div>}
          {notice && <div className="alert alert-success">{notice}</div>}

          <section className="form-section">
            <div className="form-section-title">Application details</div>
            <p className="platform-body-copy"><strong>Application type:</strong> {application.application_type_name}</p>
            <p className="platform-body-copy"><strong>Submitted:</strong> {formatDate(application.submitted_at)}</p>
            <p className="platform-body-copy"><strong>Premises:</strong> {application.premises_address || 'Not provided'}</p>
            <p className="platform-body-copy"><strong>Postcode:</strong> {application.premises_postcode || 'Not provided'}</p>
            <p className="platform-body-copy"><strong>Description:</strong> {application.premises_description || 'Not provided'}</p>
            <p className="platform-body-copy"><strong>Contact:</strong> {application.contact_name || 'Not provided'} {application.contact_email ? `| ${application.contact_email}` : ''}</p>
          </section>

          <section className="form-section">
            <div className="form-section-title">Case actions</div>
            <div className="form-group">
              <label htmlFor="decision-notes">Notes</label>
              <textarea
                id="decision-notes"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add review notes or information request details"
              />
            </div>
            <div className="platform-hero-actions">
              <button type="button" className="btn btn-secondary" onClick={() => runAction('assign')} disabled={saving}>
                {saving ? 'Working...' : 'Assign to me'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => runAction('request_information')} disabled={saving}>
                Request information
              </button>
              <button type="button" className="btn btn-primary" onClick={() => runAction('approve')} disabled={saving}>
                Approve
              </button>
              <button type="button" className="btn btn-danger" onClick={() => runAction('refuse')} disabled={saving}>
                Refuse
              </button>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-title">Decision history</div>
            {decisions.length === 0 ? (
              <p className="empty-state">No decisions recorded yet.</p>
            ) : (
              <div className="application-list">
                {decisions.map((decision) => (
                  <div key={decision.id} className="application-row">
                    <div className="application-row-main">
                      <div className="application-row-title">
                        {decision.decision_type.replaceAll('_', ' ')}
                      </div>
                      <div className="application-row-meta">
                        {decision.decided_by_name || decision.decided_by_email} | {formatDate(decision.created_at)}
                      </div>
                      {decision.notes && (
                        <div className="application-row-meta">{decision.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
