import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout.jsx';
import { api } from '../api.js';
import { useStaffAuth } from '../components/RequireStaffAuth.jsx';

const STATUS_META = {
  draft:                { label: 'Draft',              cls: 'badge-draft' },
  submitted:            { label: 'Submitted',          cls: 'badge-submitted' },
  under_review:         { label: 'Under review',       cls: 'badge-under-review' },
  awaiting_information: { label: 'Awaiting info',      cls: 'badge-awaiting' },
  waiting_on_officer:   { label: 'Waiting on officer', cls: 'badge-awaiting' },
  verified:             { label: 'Verified',           cls: 'badge-approved' },
  under_consultation:   { label: 'Consultation',       cls: 'badge-under-review' },
  licensed:             { label: 'Licensed',           cls: 'badge-approved' },
  refused:              { label: 'Refused',            cls: 'badge-refused' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status?.replace(/_/g, ' ') ?? '—', cls: 'badge-draft' };
  return <span className={`status-badge ${meta.cls}`}>{meta.label}</span>;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DataRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="case-data-row">
      <dt className="case-data-label">{label}</dt>
      <dd className="case-data-value">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event type labels and styles for timeline
// ---------------------------------------------------------------------------
const EVENT_META = {
  case_created:           { label: 'Case created',             type: 'system' },
  case_submitted:         { label: 'Case submitted',           type: 'submit' },
  case_modified:          { label: 'Case modified by applicant', type: 'modified' },
  status_changed:         { label: 'Status changed',           type: 'status' },
  officer_assigned:       { label: 'Officer assigned',         type: 'assign' },
  information_requested:  { label: 'Information requested',    type: 'request' },
  information_provided:   { label: 'Information provided',     type: 'response' },
  section_added:          { label: 'Section added',            type: 'system' },
  officer_note:           { label: 'Officer note',             type: 'note' },
  applicant_message:      { label: 'Applicant message',        type: 'message' },
  decision_made:          { label: 'Decision recorded',        type: 'decision' },
};

function TimelineEvent({ event }) {
  const meta = EVENT_META[event.event_type] ?? { label: event.event_type, type: 'system' };
  const payload = event.payload || {};

  return (
    <li className={`case-timeline-item type-${meta.type}`}>
      <div className="case-timeline-dot" aria-hidden="true" />
      <div className="case-timeline-body">
        <div className="case-timeline-label">{meta.label}</div>

        {event.actor_name && (
          <div className="case-timeline-by">by {event.actor_name}</div>
        )}

        {/* Status change: show from → to */}
        {event.event_type === 'status_changed' && payload.from && payload.to && (
          <div className="case-timeline-detail">
            <StatusBadge status={payload.from} /> → <StatusBadge status={payload.to} />
          </div>
        )}

        {/* Information request or response */}
        {(event.event_type === 'information_requested' || event.event_type === 'information_provided') && payload.notes && (
          <div className="case-timeline-notes">{payload.notes}</div>
        )}

        {/* Officer note */}
        {event.event_type === 'officer_note' && payload.body && (
          <div className="case-timeline-notes case-timeline-internal">{payload.body}</div>
        )}

        {/* Decision */}
        {event.event_type === 'decision_made' && payload.decision && (
          <div className="case-timeline-notes">
            <strong>{payload.decision === 'licensed' ? 'Licensed' : 'Refused'}</strong>
            {payload.notes && `: ${payload.notes}`}
          </div>
        )}

        {/* Assignment */}
        {event.event_type === 'officer_assigned' && payload.user_name && (
          <div className="case-timeline-detail">Assigned to {payload.user_name}</div>
        )}

        <div className="case-timeline-date">{formatDate(event.created_at)}</div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AdminCaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, logout, refresh } = useStaffAuth();

  const [plc, setPlc]           = useState(null);
  const [sections, setSections] = useState([]);
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showNote, setShowNote] = useState(false);

  // Action panel: null | 'request_info' | 'verify' | 'licensed' | 'refused'
  const [activeAction, setActiveAction] = useState(null);
  const [actionNotes, setActionNotes]   = useState('');

  async function loadCase() {
    const data = await api.getPremiseCase(id);
    setPlc(data.case);
    setSections(data.sections ?? []);
    setEvents(data.events ?? []);
  }

  useEffect(() => {
    let active = true;
    loadCase()
      .catch((err) => { if (active) setError(err.message || 'Could not load case.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  function openAction(action) {
    setActiveAction(action);
    setActionNotes('');
    setError('');
    setNotice('');
  }

  function cancelAction() {
    setActiveAction(null);
    setActionNotes('');
  }

  async function runAction(action) {
    if (action === 'refused' && !actionNotes.trim()) {
      setError('A reason is required when refusing a case.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (action === 'delete') {
        if (!window.confirm('Delete this case? This cannot be undone.')) { setSaving(false); return; }
        await api.deletePremiseCase(id);
        navigate('/admin/cases');
        return;
      }

      if (action === 'assign') {
        await api.assignPremiseCase(id, { assigned_user_id: session.user_id });
        setNotice('Case assigned to you.');
      } else if (action === 'request_info') {
        await api.requestPremiseCaseInformation(id, { notes: actionNotes });
        setNotice('Information requested from applicant.');
      } else if (action === 'verify') {
        await api.verifyPremiseCase(id, { notes: actionNotes });
        setNotice('Case marked as verified.');
      } else if (action === 'licensed' || action === 'refused') {
        await api.decidePremiseCase(id, { decision: action, notes: actionNotes });
        setNotice(action === 'licensed' ? 'Licence granted.' : 'Case refused.');
      }

      setActiveAction(null);
      setActionNotes('');
      await loadCase();
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  }

  async function submitNote() {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await api.addPremiseCaseNote(id, { body: noteText });
      setNoteText('');
      setShowNote(false);
      await loadCase();
    } catch (err) {
      setError(err.message || 'Could not save note.');
    } finally {
      setSaving(false);
    }
  }

  const isAssignedToMe = plc?.assigned_user_id === session.user_id;
  const isClosed       = ['licensed', 'refused'].includes(plc?.status);
  const isActive       = !isClosed && plc?.status !== 'draft';

  const REVIEW_STATUSES = ['submitted', 'under_review', 'waiting_on_officer'];
  const canRequestInfo  = REVIEW_STATUSES.includes(plc?.status);
  const canVerify       = ['under_review', 'waiting_on_officer'].includes(plc?.status);
  const canDecide       = ['verified', 'under_consultation'].includes(plc?.status);

  return (
    <AdminLayout
      session={session}
      onSignOut={logout}
      onSessionRefresh={refresh}
      breadcrumbs={[
        { to: '/admin/dashboard', label: 'Dashboard' },
        { to: '/admin/cases', label: 'Cases' },
        { label: plc?.premises_name || 'Case' },
      ]}
    >
      <Link to="/admin/cases" className="back-link">← Back to cases</Link>

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : !plc ? (
        <div className="alert alert-error">Case not found.</div>
      ) : (
        <>
          {/* Case header */}
          <section className="case-header">
            <div className="case-header-main">
              <div className="case-header-ref">{plc.ref}</div>
              <h1 className="page-title">{plc.premises_name}</h1>
              <div className="case-header-meta">
                <StatusBadge status={plc.status} />
                {plc.postcode && <span className="case-header-postcode">{plc.postcode}</span>}
                {plc.last_modified_at && (
                  <span className="case-modified-badge">Modified {formatDate(plc.last_modified_at)}</span>
                )}
              </div>
              <div className="case-header-assignment">
                {isAssignedToMe
                  ? <span className="case-assigned-me">Assigned to you</span>
                  : plc.assigned_user_name
                    ? <span>Assigned to <strong>{plc.assigned_user_name}</strong></span>
                    : <span className="case-unassigned">Unassigned</span>}
              </div>
            </div>
          </section>

          {error  && <div className="alert alert-error">{error}</div>}
          {notice && <div className="alert alert-success">{notice}</div>}

          <div className="case-layout">
            {/* Left: case information */}
            <div className="case-content">

              {/* Premises details */}
              <section className="form-section">
                <div className="form-section-title">Premises</div>
                <dl className="case-data-grid">
                  <DataRow label="Name"        value={plc.premises_name} />
                  <DataRow label="Address"     value={[plc.address_line_1, plc.address_line_2, plc.town_or_city].filter(Boolean).join(', ')} />
                  <DataRow label="Postcode"    value={plc.postcode} />
                  <DataRow label="Description" value={plc.premises_description} />
                </dl>
              </section>

              {/* Applicant */}
              <section className="form-section">
                <div className="form-section-title">Applicant</div>
                <dl className="case-data-grid">
                  <DataRow label="Name"  value={plc.applicant_name} />
                  <DataRow label="Email" value={plc.applicant_email} />
                </dl>
              </section>

              {/* Selected sections */}
              {sections.length > 0 && (
                <section className="form-section">
                  <div className="form-section-title">Licence sections</div>
                  {sections.map((sec) => (
                    <div key={sec.id} className="case-section-block">
                      <div className="case-section-name">{sec.section_name}</div>
                      {sec.section_description && (
                        <p className="case-section-desc">{sec.section_description}</p>
                      )}
                      {Array.isArray(sec.section_fields) && sec.section_fields.length > 0 && (
                        <dl className="case-data-grid case-section-answers">
                          {sec.section_fields.map((field) => {
                            const val = sec.answers?.[field.key];
                            if (val === undefined || val === null || val === '') return null;
                            const display = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
                            return <DataRow key={field.key} label={field.label} value={display} />;
                          })}
                        </dl>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {/* Timeline */}
              {events.length > 0 && (
                <section className="form-section">
                  <div className="form-section-title">Case timeline</div>
                  <ol className="case-timeline">
                    {events.map((ev) => (
                      <TimelineEvent key={ev.id} event={ev} />
                    ))}
                  </ol>
                </section>
              )}

              {/* Add officer note */}
              {isActive && (
                <section className="form-section">
                  <div className="form-section-title">Add note</div>
                  {showNote ? (
                    <div className="case-action-panel">
                      <p className="case-action-panel-hint">Internal note — not visible to the applicant.</p>
                      <textarea
                        className="case-action-textarea"
                        rows={3}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Enter your note..."
                        autoFocus
                      />
                      <div className="case-action-panel-btns">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowNote(false)} disabled={saving}>Cancel</button>
                        <button type="button" className="btn btn-primary" onClick={submitNote} disabled={saving || !noteText.trim()}>
                          {saving ? 'Saving…' : 'Save note'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-secondary" onClick={() => setShowNote(true)}>
                      Add internal note
                    </button>
                  )}
                </section>
              )}
            </div>

            {/* Right: actions sidebar */}
            <aside className="case-sidebar">
              <div className="case-actions-card">
                <div className="case-actions-title">Case actions</div>

                {isClosed ? (
                  <>
                    <p className="case-closed-note">
                      This case is <strong>{plc.status}</strong>. No further actions available.
                    </p>
                    {session.role === 'manager' && (
                      <>
                        <div className="case-actions-divider" />
                        <button type="button" className="btn btn-danger case-action-btn" onClick={() => runAction('delete')} disabled={saving}>
                          Delete case
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {!isAssignedToMe && (
                      <button type="button" className="btn btn-secondary case-action-btn" onClick={() => runAction('assign')} disabled={saving}>
                        Assign to me
                      </button>
                    )}

                    {/* Request information */}
                    {canRequestInfo && (
                      activeAction === 'request_info' ? (
                        <div className="case-action-panel">
                          <div className="case-action-panel-title">Request information</div>
                          <p className="case-action-panel-hint">Describe what is needed from the applicant.</p>
                          <textarea
                            className="case-action-textarea"
                            rows={3}
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            placeholder="What documents or information are required?"
                            autoFocus
                          />
                          <div className="case-action-panel-btns">
                            <button type="button" className="btn btn-secondary" onClick={cancelAction} disabled={saving}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={() => runAction('request_info')} disabled={saving || !actionNotes.trim()}>
                              {saving ? 'Sending…' : 'Send request'}
                            </button>
                          </div>
                        </div>
                      ) : activeAction == null && (
                        <button type="button" className="btn btn-secondary case-action-btn" onClick={() => openAction('request_info')} disabled={saving}>
                          Request information
                        </button>
                      )
                    )}

                    {/* Verify */}
                    {canVerify && (
                      activeAction === 'verify' ? (
                        <div className="case-action-panel case-action-panel-approve">
                          <div className="case-action-panel-title">Mark as verified</div>
                          <p className="case-action-panel-hint">Confirming all information and documents have been reviewed.</p>
                          <textarea
                            className="case-action-textarea"
                            rows={2}
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            placeholder="Optional notes on verification…"
                            autoFocus
                          />
                          <div className="case-action-panel-btns">
                            <button type="button" className="btn btn-secondary" onClick={cancelAction} disabled={saving}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={() => runAction('verify')} disabled={saving}>
                              {saving ? 'Saving…' : 'Mark verified'}
                            </button>
                          </div>
                        </div>
                      ) : activeAction == null && (
                        <button type="button" className="btn btn-primary case-action-btn" onClick={() => openAction('verify')} disabled={saving}>
                          Mark as verified
                        </button>
                      )
                    )}

                    {/* Grant licence */}
                    {canDecide && (
                      activeAction === 'licensed' ? (
                        <div className="case-action-panel case-action-panel-approve">
                          <div className="case-action-panel-title">Grant licence</div>
                          <textarea
                            className="case-action-textarea"
                            rows={2}
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            placeholder="Optional notes on decision…"
                            autoFocus
                          />
                          <div className="case-action-panel-btns">
                            <button type="button" className="btn btn-secondary" onClick={cancelAction} disabled={saving}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={() => runAction('licensed')} disabled={saving}>
                              {saving ? 'Granting…' : 'Grant licence'}
                            </button>
                          </div>
                        </div>
                      ) : activeAction !== 'refused' && (
                        <button type="button" className="btn btn-primary case-action-btn" onClick={() => openAction('licensed')} disabled={saving}>
                          Grant licence
                        </button>
                      )
                    )}

                    {/* Refuse */}
                    {canDecide && (
                      activeAction === 'refused' ? (
                        <div className="case-action-panel case-action-panel-refuse">
                          <div className="case-action-panel-title">Refuse case</div>
                          <p className="case-action-panel-hint">A reason is required. The applicant will be notified.</p>
                          <textarea
                            className="case-action-textarea"
                            rows={3}
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            placeholder="Reason for refusal (required)…"
                            autoFocus
                          />
                          <div className="case-action-panel-btns">
                            <button type="button" className="btn btn-secondary" onClick={cancelAction} disabled={saving}>Cancel</button>
                            <button type="button" className="btn btn-danger" onClick={() => runAction('refused')} disabled={saving || !actionNotes.trim()}>
                              {saving ? 'Refusing…' : 'Confirm refusal'}
                            </button>
                          </div>
                        </div>
                      ) : activeAction !== 'licensed' && (
                        <button type="button" className="btn btn-danger case-action-btn" onClick={() => openAction('refused')} disabled={saving}>
                          Refuse
                        </button>
                      )
                    )}

                    <div className="case-actions-divider" />
                    <button type="button" className="btn btn-danger case-action-btn" onClick={() => runAction('delete')} disabled={saving}>
                      Delete case
                    </button>
                  </>
                )}
              </div>

              {/* Case metadata */}
              <div className="case-actions-card" style={{ marginTop: '1rem' }}>
                <div className="case-actions-title">Case info</div>
                <dl className="case-data-grid">
                  <DataRow label="Submitted"     value={formatDate(plc.submitted_at)} />
                  <DataRow label="Last modified" value={plc.last_modified_at ? formatDate(plc.last_modified_at) : null} />
                  <DataRow label="Updated"       value={formatDate(plc.updated_at)} />
                </dl>
              </div>
            </aside>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
