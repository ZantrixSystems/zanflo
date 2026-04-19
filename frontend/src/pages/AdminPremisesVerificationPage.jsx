import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout.jsx';
import { api } from '../api.js';
import { useStaffAuth } from '../components/RequireStaffAuth.jsx';


function formatDate(value) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString('en-GB');
}

const VERIFICATION_STATE_LABELS = {
  unverified: 'Not submitted',
  pending_verification: 'Awaiting review',
  verified: 'Verified',
  verification_refused: 'Refused',
  more_information_required: 'Info required',
};

// ---------------------------------------------------------------------------
// List page
// ---------------------------------------------------------------------------
const VERIFICATION_BADGE = {
  pending_verification:      { label: 'Awaiting review',  cls: 'badge-submitted' },
  more_information_required: { label: 'Info required',    cls: 'badge-awaiting' },
  verified:                  { label: 'Verified',         cls: 'badge-approved' },
  verification_refused:      { label: 'Refused',          cls: 'badge-refused' },
  unverified:                { label: 'Not submitted',    cls: 'badge-draft' },
};

function VerificationBadge({ state }) {
  const meta = VERIFICATION_BADGE[state] ?? { label: state?.replace(/_/g, ' ') ?? 'Unknown', cls: 'badge-draft' };
  return <span className={`status-badge ${meta.cls}`}>{meta.label}</span>;
}

function formatShortDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function AdminPremisesVerificationListPage() {
  const { session, logout, refresh } = useStaffAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stateFilter, setStateFilter] = useState('pending_verification');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.listAdminPremisesVerifications({ state: stateFilter })
      .then((data) => { if (active) setItems(data.premises_verifications ?? []); })
      .catch((err) => { if (active) setError(err.message || 'Could not load verification requests.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [stateFilter]);

  return (
    <AdminLayout
      session={session}
      onSignOut={logout}
      onSessionRefresh={refresh}
      breadcrumbs={[
        { to: '/admin/dashboard', label: 'Dashboard' },
        { label: 'Premises verifications' },
      ]}
    >
      <section className="form-section">
        <h1 className="page-title">Premises verifications</h1>
        <p className="page-subtitle">
          Review applicants&apos; claims to their premises before they can submit licence applications.
        </p>
      </section>

      <div className="queue-toolbar">
        <div className="queue-filters">
          <select
            className="queue-filter-select"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            aria-label="Filter by state"
          >
            <option value="pending_verification">Awaiting review</option>
            <option value="more_information_required">More info required</option>
            <option value="verified">Verified</option>
            <option value="verification_refused">Refused</option>
            <option value="all">All states</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : items.length === 0 ? (
        <div className="queue-empty">
          <div className="queue-empty-title">No premises verifications match this filter</div>
        </div>
      ) : (
        <div className="queue-table-wrap">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Premises</th>
                <th>Address</th>
                <th>Applicant</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="queue-table-row"
                  onClick={() => { window.location.href = `/admin/premises-verifications/${row.id}`; }}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') window.location.href = `/admin/premises-verifications/${row.id}`; }}
                  role="link"
                  aria-label={`Premises verification: ${row.premises_name}`}
                >
                  <td className="queue-col-premises">
                    <Link
                      to={`/admin/premises-verifications/${row.id}`}
                      className="queue-ref-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.premises_name || '—'}
                    </Link>
                  </td>
                  <td className="queue-col-type">
                    {[row.address_line_1, row.town_or_city, row.postcode].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="queue-col-assigned">
                    {row.applicant_name || row.applicant_email || '—'}
                  </td>
                  <td className="queue-col-status">
                    <VerificationBadge state={row.verification_state} />
                  </td>
                  <td className="queue-col-date">{formatShortDate(row.last_submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

// ---------------------------------------------------------------------------
// Detail / decision page
// ---------------------------------------------------------------------------
export function AdminPremisesVerificationDetailPage() {
  const { id } = useParams();
  const { session, logout, refresh } = useStaffAuth();
  const navigate = useNavigate();
  const [premises, setPremises] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notes, setNotes] = useState('');

  async function loadDetail() {
    const data = await api.getAdminPremisesVerification(id);
    setPremises(data.premises);
    setEvents(data.verification_events ?? []);
  }

  useEffect(() => {
    let active = true;
    loadDetail()
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Could not load premises.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  async function recordDecision(decision) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.decideAdminPremisesVerification(id, { decision, notes });
      setNotes('');
      setNotice(`Decision recorded: ${decision.replace(/_/g, ' ')}.`);
      await loadDetail();
    } catch (err) {
      setError(err.message || 'Could not record decision.');
    } finally {
      setSaving(false);
    }
  }

  const isPending = premises?.verification_state === 'pending_verification';

  return (
    <AdminLayout
      session={session}
      onSignOut={logout}
      onSessionRefresh={refresh}
      breadcrumbs={[
        { to: '/admin/dashboard', label: 'Council admin' },
        { to: '/admin/premises-verifications', label: 'Premises verifications' },
        { label: 'Premises detail' },
      ]}
    >
      <Link to="/admin/premises-verifications" className="back-link">
        Back to verification queue
      </Link>

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : !premises ? (
        <div className="alert alert-error">Premises not found.</div>
      ) : (
        <>
          <section className="form-section">
            <div className="form-section-title">Premises verification</div>
            <h1 className="page-title">{premises.premises_name}</h1>
            <p className="page-subtitle">
              Status:{' '}
              <strong>
                {VERIFICATION_STATE_LABELS[premises.verification_state] ?? premises.verification_state}
              </strong>
            </p>
          </section>

          <section className="form-section">
            <div className="form-section-title">Premises details</div>
            <p className="platform-body-copy">
              <strong>Address:</strong>{' '}
              {[premises.address_line_1, premises.address_line_2, premises.town_or_city, premises.postcode]
                .filter(Boolean)
                .join(', ')}
            </p>
            {premises.premises_description && (
              <p className="platform-body-copy">
                <strong>Description:</strong> {premises.premises_description}
              </p>
            )}
          </section>

          <section className="form-section">
            <div className="form-section-title">Applicant</div>
            <p className="platform-body-copy">
              <strong>Name:</strong> {premises.applicant_name || 'Not provided'}
            </p>
            <p className="platform-body-copy">
              <strong>Email:</strong> {premises.applicant_email || 'Not provided'}
            </p>
            {premises.applicant_phone && (
              <p className="platform-body-copy">
                <strong>Phone:</strong> {premises.applicant_phone}
              </p>
            )}
          </section>

          {error && <div className="alert alert-error">{error}</div>}
          {notice && <div className="alert alert-success">{notice}</div>}

          {isPending && (
            <section className="form-section">
              <div className="form-section-title">Record decision</div>
              <div className="form-group">
                <label htmlFor="decision-notes">Notes</label>
                <textarea
                  id="decision-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes to explain the decision or request specific information"
                />
              </div>
              <div className="platform-hero-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => recordDecision('verified')}
                  disabled={saving}
                >
                  {saving ? 'Working...' : 'Verify premises'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => recordDecision('more_information_required')}
                  disabled={saving}
                >
                  Request more information
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => recordDecision('verification_refused')}
                  disabled={saving}
                >
                  Refuse verification
                </button>
              </div>
            </section>
          )}

          {!isPending && (
            <section className="form-section">
              <div className="form-section-title">Current state</div>
              <p className="platform-body-copy">
                This premises is not in a pending state. No action is available.
              </p>
            </section>
          )}

          <section className="form-section">
            <div className="form-section-title">Verification history</div>
            {events.length === 0 ? (
              <p className="empty-state">No verification events recorded yet.</p>
            ) : (
              <div className="application-list">
                {events.map((evt) => (
                  <div key={evt.id} className="application-row">
                    <div className="application-row-main">
                      <div className="application-row-title">
                        {evt.event_type.replace(/_/g, ' ')}
                      </div>
                      <div className="application-row-meta">
                        {evt.actor_name || evt.actor_email || `${evt.actor_type}`} · {formatDate(evt.created_at)}
                      </div>
                      {evt.notes && (
                        <div className="application-row-meta">{evt.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
}
