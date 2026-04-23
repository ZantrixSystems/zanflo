import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../auth-context.jsx';
import { buildApplicantNav } from '../lib/navigation.js';

const STATUS_META = {
  draft:                  { label: 'Draft',              cls: 'appl-status-draft' },
  submitted:              { label: 'Submitted',          cls: 'appl-status-submitted' },
  under_review:           { label: 'Under review',       cls: 'appl-status-review' },
  returned_to_applicant:  { label: 'Returned to you',   cls: 'appl-status-returned' },
  awaiting_information:   { label: 'Info requested',     cls: 'appl-status-info' },
  waiting_on_officer:     { label: 'Response sent',      cls: 'appl-status-submitted' },
  under_consultation:     { label: 'Consultation',       cls: 'appl-status-review' },
  licensed:               { label: 'Licensed',           cls: 'appl-status-approved' },
  refused:                { label: 'Refused',            cls: 'appl-status-refused' },
};

const EVENT_META = {
  case_created:           { label: 'Case opened',            type: 'system' },
  case_submitted:         { label: 'Case submitted',         type: 'submit' },
  case_modified:          { label: 'Case updated',           type: 'modified' },
  status_changed:         { label: 'Status changed',         type: 'status' },
  officer_assigned:       { label: 'Officer assigned',       type: 'system' },
  information_requested:  { label: 'Information requested',  type: 'request' },
  information_provided:   { label: 'Information provided',   type: 'response' },
  note_public:            { label: 'Comment from council',   type: 'comment' },
  applicant_message:      { label: 'Your message',           type: 'message' },
  decision_made:          { label: 'Decision recorded',      type: 'decision' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label: status?.replace(/_/g, ' ') ?? '—', cls: '' };
  return <span className={`appl-status-badge ${m.cls}`}>{m.label}</span>;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function TimelineEvent({ event }) {
  const meta    = EVENT_META[event.event_type] ?? { label: event.event_type, type: 'system' };
  const payload = event.payload || {};
  const isOfficerComment = event.event_type === 'note_public';
  const isApplicantMsg   = event.event_type === 'applicant_message';

  return (
    <li className={`ac-timeline-item ac-tl-type-${meta.type}`}>
      <div className="ac-timeline-dot" aria-hidden="true" />
      <div className={`ac-timeline-card${isOfficerComment ? ' ac-timeline-card--council' : ''}${isApplicantMsg ? ' ac-timeline-card--you' : ''}`}>
        <div className="ac-timeline-card-header">
          <span className="ac-timeline-label">{meta.label}</span>
          <span className="ac-timeline-date">{formatDateTime(event.created_at)}</span>
        </div>

        {event.actor_name && !isApplicantMsg && (
          <div className="ac-timeline-by">{event.actor_name}</div>
        )}

        {event.event_type === 'status_changed' && payload.from && payload.to && (
          <div className="ac-timeline-status-change">
            <span className="ac-timeline-status-from">{payload.from.replace(/_/g, ' ')}</span>
            <span className="ac-timeline-arrow">→</span>
            <span className="ac-timeline-status-to">{payload.to.replace(/_/g, ' ')}</span>
          </div>
        )}

        {(isOfficerComment || isApplicantMsg) && payload.body && (
          <div className="ac-timeline-body">{payload.body}</div>
        )}

        {event.event_type === 'information_requested' && payload.notes && (
          <div className="ac-timeline-body ac-timeline-body--request">{payload.notes}</div>
        )}

        {event.event_type === 'information_provided' && payload.notes && (
          <div className="ac-timeline-body">{payload.notes}</div>
        )}

        {event.event_type === 'decision_made' && payload.decision && (
          <div className="ac-timeline-body">
            <strong>{payload.decision === 'licensed' ? 'Licence granted' : 'Application refused'}</strong>
            {payload.notes && <p style={{ marginTop: 4 }}>{payload.notes}</p>}
          </div>
        )}
      </div>
    </li>
  );
}

export default function ApplicantCaseDetailPage() {
  const { id } = useParams();
  const { session } = useAuth();

  const [caseData, setCaseData]   = useState(null);
  const [events, setEvents]       = useState([]);
  const [sections, setSections]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [msgText, setMsgText]     = useState('');
  const [sending, setSending]     = useState(false);
  const [msgError, setMsgError]   = useState('');

  async function load() {
    try {
      const data = await api.getApplicantCase(id);
      setCaseData(data.case);
      setEvents(data.events ?? []);
      setSections(data.sections ?? []);
    } catch (err) {
      setError(err.message || 'Could not load case.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function sendMessage() {
    if (!msgText.trim()) return;
    setSending(true);
    setMsgError('');
    try {
      await api.addApplicantMessage(id, { body: msgText });
      setMsgText('');
      await load();
    } catch (err) {
      setMsgError(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  const canMessage = caseData && !['draft'].includes(caseData.status);
  const needsAction = ['returned_to_applicant', 'awaiting_information'].includes(caseData?.status);

  return (
    <Layout
      breadcrumbs={[
        { to: '/', label: 'Home' },
        { to: '/premises', label: 'Premises' },
        { label: caseData?.premises_name ?? 'Case' },
      ]}
      navItems={buildApplicantNav(session)}
    >
      <Link to="/premises" className="back-link">← Back to premises</Link>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner">Loading…</div>
      ) : caseData ? (
        <div className="ac-layout">
          {/* Left — timeline */}
          <div className="ac-main">
            {/* Case header */}
            <div className="ac-case-header">
              <div className="ac-case-header-top">
                <h1 className="ac-case-title">{caseData.premises_name}</h1>
                <StatusBadge status={caseData.status} />
              </div>
              <div className="ac-case-address">
                {[caseData.address_line_1, caseData.town_or_city, caseData.postcode].filter(Boolean).join(', ')}
              </div>
              {caseData.ref && (
                <div className="ac-case-ref">Ref: {caseData.ref}</div>
              )}
            </div>

            {/* Action notice */}
            {needsAction && (
              <div className="ac-action-banner">
                {caseData.status === 'returned_to_applicant'
                  ? 'The officer has returned this case. Review the comments below, make any changes, and resubmit.'
                  : 'The council has requested more information. Please review the request below and respond.'}
                <Link to={`/cases/${id}/edit`} className="btn btn-primary btn-sm" style={{ marginLeft: 16 }}>
                  {caseData.status === 'returned_to_applicant' ? 'Edit and resubmit' : 'Provide information'}
                </Link>
              </div>
            )}

            {/* Sections */}
            {sections.length > 0 && (
              <div className="ac-sections">
                <div className="ac-sections-label">Licence sections applied for</div>
                <div className="ac-sections-list">
                  {sections.map((s) => (
                    <span key={s.id} className="ac-section-tag">{s.section_name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="ac-timeline-area">
              <div className="ac-timeline-heading">Case activity</div>
              {events.length === 0 ? (
                <p className="ac-timeline-empty">No activity yet.</p>
              ) : (
                <ol className="ac-timeline">
                  {[...events].reverse().map((evt) => (
                    <TimelineEvent key={evt.id} event={evt} />
                  ))}
                </ol>
              )}
            </div>

            {/* Message box */}
            {canMessage && (
              <div className="ac-message-box">
                <div className="ac-message-box-label">Send a message to the council</div>
                <textarea
                  className="ac-message-textarea"
                  rows={3}
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  placeholder="Type your message here…"
                />
                {msgError && <div className="alert alert-error" style={{ marginTop: 8 }}>{msgError}</div>}
                <div className="ac-message-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={sendMessage}
                    disabled={sending || !msgText.trim()}
                  >
                    {sending ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right — info sidebar */}
          <aside className="ac-sidebar">
            <div className="ac-info-card">
              <div className="ac-info-title">Case details</div>
              <dl className="ac-info-list">
                <div className="ac-info-row">
                  <dt>Status</dt>
                  <dd><StatusBadge status={caseData.status} /></dd>
                </div>
                {caseData.ref && (
                  <div className="ac-info-row">
                    <dt>Reference</dt>
                    <dd>{caseData.ref}</dd>
                  </div>
                )}
                {caseData.created_at && (
                  <div className="ac-info-row">
                    <dt>Opened</dt>
                    <dd>{formatDate(caseData.created_at)}</dd>
                  </div>
                )}
                {caseData.submitted_at && (
                  <div className="ac-info-row">
                    <dt>Submitted</dt>
                    <dd>{formatDate(caseData.submitted_at)}</dd>
                  </div>
                )}
                {caseData.last_modified_at && (
                  <div className="ac-info-row">
                    <dt>Last updated</dt>
                    <dd>{formatDate(caseData.last_modified_at)}</dd>
                  </div>
                )}
              </dl>
            </div>

            {sections.length > 0 && (
              <div className="ac-info-card">
                <div className="ac-info-title">Sections</div>
                <ul className="ac-sidebar-sections">
                  {sections.map((s) => (
                    <li key={s.id}>{s.section_name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ac-info-card ac-info-card--muted">
              <div className="ac-info-title">Need help?</div>
              <p className="ac-info-hint">
                If you have a question about your application, use the message box to contact the licensing team directly.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </Layout>
  );
}
