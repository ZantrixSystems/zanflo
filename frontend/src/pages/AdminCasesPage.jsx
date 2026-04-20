import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout.jsx';
import { api } from '../api.js';
import { useStaffAuth } from '../components/RequireStaffAuth.jsx';

// ---------------------------------------------------------------------------
// Status metadata for premise_licence_cases
// ---------------------------------------------------------------------------
const STATUS_META = {
  draft:                { label: 'Draft',               cls: 'badge-draft' },
  submitted:            { label: 'Submitted',           cls: 'badge-submitted' },
  under_review:         { label: 'Under review',        cls: 'badge-under-review' },
  awaiting_information: { label: 'Awaiting info',       cls: 'badge-awaiting' },
  waiting_on_officer:   { label: 'Waiting on officer',  cls: 'badge-awaiting' },
  verified:             { label: 'Verified',            cls: 'badge-approved' },
  under_consultation:   { label: 'Consultation',        cls: 'badge-under-review' },
  licensed:             { label: 'Licensed',            cls: 'badge-approved' },
  refused:              { label: 'Refused',             cls: 'badge-refused' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status?.replace(/_/g, ' ') ?? '—', cls: 'badge-draft' };
  return <span className={`status-badge ${meta.cls}`}>{meta.label}</span>;
}

function formatRef(row) {
  if (!row.ref_number) return '—';
  const prefix = (row.tenant_slug || 'CASE').slice(0, 4).toUpperCase();
  return `${prefix}-${String(row.ref_number).padStart(6, '0')}`;
}

function formatShortDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ---------------------------------------------------------------------------
// Active filter tags
// ---------------------------------------------------------------------------
const STATUS_LABELS = {
  submitted: 'Submitted', under_review: 'Under review', awaiting_information: 'Awaiting info',
  waiting_on_officer: 'Waiting on officer', verified: 'Verified',
  under_consultation: 'Consultation', licensed: 'Licensed', refused: 'Refused',
};

function ActiveFilterTags({ filters, onClear }) {
  const tags = [];
  if (filters.status)        tags.push({ key: 'status',        label: STATUS_LABELS[filters.status] || filters.status });
  if (filters.assigned)      tags.push({ key: 'assigned',      label: filters.assigned === 'mine' ? 'Assigned to me' : 'Unassigned' });
  if (filters.search)        tags.push({ key: 'search',        label: `Search: "${filters.search}"` });
  if (filters.postcode)      tags.push({ key: 'postcode',      label: `Postcode: ${filters.postcode}` });
  if (filters.updated_after) tags.push({ key: 'updated_after', label: `Updated after ${filters.updated_after}` });

  if (tags.length === 0) return null;

  return (
    <div className="active-filter-tags">
      {tags.map((tag) => (
        <span key={tag.key} className="active-filter-tag">
          {tag.label}
          <button
            type="button"
            className="active-filter-tag-remove"
            onClick={() => onClear(tag.key)}
            aria-label={`Remove filter: ${tag.label}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AdminCasesPage() {
  const { session, logout, refresh } = useStaffAuth();
  const [urlParams, setUrlParams] = useSearchParams();

  // Read filter state from URL
  const status       = urlParams.get('status') || '';
  const assigned     = urlParams.get('assigned') || '';
  const search       = urlParams.get('search') || '';
  const postcode     = urlParams.get('postcode') || '';
  const updatedAfter = urlParams.get('updated_after') || '';
  const sort         = urlParams.get('sort') || 'updated';

  // Local state for the search input (debounced before writing to URL)
  const [searchInput, setSearchInput] = useState(search);
  const [postcodeInput, setPostcodeInput] = useState(postcode);

  const [cases, setCases]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [assigningId, setAssigningId] = useState(null);

  // Debounce search → URL param
  useEffect(() => {
    const timer = setTimeout(() => {
      setParam('search', searchInput.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setParam('postcode', postcodeInput.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [postcodeInput]);

  // Sync local input state if URL changes externally (e.g. saved filter applied)
  useEffect(() => { setSearchInput(urlParams.get('search') || ''); }, [urlParams.get('search')]);
  useEffect(() => { setPostcodeInput(urlParams.get('postcode') || ''); }, [urlParams.get('postcode')]);

  // Fetch cases whenever URL filters change
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api.listPremiseCases({
      status:        status || undefined,
      assigned:      assigned || undefined,
      search:        search || undefined,
      postcode:      postcode || undefined,
      updated_after: updatedAfter || undefined,
      sort,
    })
      .then((data) => { if (active) setCases(data.cases ?? []); })
      .catch((err) => { if (active) setError(err.message || 'Could not load cases.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [status, assigned, search, postcode, updatedAfter, sort]);

  function setParam(key, value) {
    setUrlParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) { next.set(key, value); } else { next.delete(key); }
      return next;
    });
  }

  function clearParam(key) {
    setParam(key, '');
    if (key === 'search')   setSearchInput('');
    if (key === 'postcode') setPostcodeInput('');
  }

  function clearAllFilters() {
    setUrlParams({});
    setSearchInput('');
    setPostcodeInput('');
  }

  async function handleSelfAssign(e, caseId) {
    e.stopPropagation();
    setAssigningId(caseId);
    try {
      await api.assignPremiseCase(caseId, { assigned_user_id: session.user_id });
      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? { ...c, assigned_user_id: session.user_id, assigned_user_name: session.full_name }
            : c
        )
      );
    } catch {
      // silent — user can open the case if needed
    } finally {
      setAssigningId(null);
    }
  }

  const hasActiveFilters = !!(status || assigned || search || postcode || updatedAfter);
  const activeFilters    = { status, assigned, search, postcode, updated_after: updatedAfter };

  return (
    <AdminLayout
      session={session}
      onSignOut={logout}
      onSessionRefresh={refresh}
      breadcrumbs={[
        { to: '/admin/dashboard', label: 'Dashboard' },
        { label: 'All applications' },
      ]}
    >
      <div className="queue-page-header">
        <h1 className="queue-page-title">Premises applications</h1>
        <p className="queue-page-subtitle">All premises licence applications. Use filters to narrow the list.</p>
      </div>

      {/* Filter toolbar */}
      <div className="queue-toolbar">
        <div className="queue-filters">
          {/* Free text search */}
          <input
            type="search"
            className="queue-search-input"
            placeholder="Search premises, postcode, street…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search cases"
          />

          {/* Status */}
          <select
            className={`queue-filter-select${status ? ' is-active' : ''}`}
            value={status}
            onChange={(e) => setParam('status', e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">Status</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="awaiting_information">Awaiting info</option>
            <option value="waiting_on_officer">Waiting on officer</option>
            <option value="verified">Verified</option>
            <option value="under_consultation">Consultation</option>
            <option value="licensed">Licensed</option>
            <option value="refused">Refused</option>
          </select>

          {/* Assigned */}
          <select
            className={`queue-filter-select${assigned ? ' is-active' : ''}`}
            value={assigned}
            onChange={(e) => setParam('assigned', e.target.value)}
            aria-label="Filter by assignment"
          >
            <option value="">Assigned to</option>
            <option value="mine">Me</option>
            <option value="unassigned">Unassigned</option>
          </select>

          {/* Postcode narrow */}
          <input
            type="text"
            className={`queue-filter-input${postcode ? ' is-active' : ''}`}
            placeholder="Postcode"
            value={postcodeInput}
            onChange={(e) => setPostcodeInput(e.target.value)}
            aria-label="Filter by postcode"
          />

          {/* Updated after date */}
          <input
            type="date"
            className={`queue-filter-input${updatedAfter ? ' is-active' : ''}`}
            value={updatedAfter}
            onChange={(e) => setParam('updated_after', e.target.value)}
            aria-label="Updated after date"
            title="Show cases updated after this date"
          />
        </div>

        <div className="queue-sort">
          <select
            className="queue-filter-select"
            value={sort}
            onChange={(e) => setParam('sort', e.target.value)}
            aria-label="Sort by"
          >
            <option value="updated">Sort: last updated</option>
            <option value="created">Sort: date created</option>
            <option value="status">Sort: status</option>
            <option value="ref">Sort: case ref</option>
          </select>
        </div>
      </div>

      {/* Active filter chips */}
      <ActiveFilterTags filters={activeFilters} onClear={clearParam} />

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : cases.length === 0 ? (
        <div className="queue-empty">
          <div className="queue-empty-title">
            {hasActiveFilters ? 'No applications match these filters' : 'No applications found'}
          </div>
          {hasActiveFilters && (
            <p className="queue-empty-hint">
              <button type="button" className="link-btn" onClick={clearAllFilters}>
                Clear all filters
              </button>{' '}
              to see all applications.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="queue-count">{cases.length} application{cases.length === 1 ? '' : 's'}</div>
          <div className="queue-table-wrap">
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Premises</th>
                  <th>Sections</th>
                  <th>Status</th>
                  <th>Assigned to</th>
                  <th>Applicant</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((row) => {
                  const path = `/admin/premise-cases/${row.id}`;
                  return (
                    <tr
                      key={row.id}
                      className="queue-table-row"
                      onClick={() => { window.location.href = path; }}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') window.location.href = path; }}
                      role="link"
                      aria-label={`Application: ${formatRef(row)}`}
                    >
                      <td className="queue-col-ref">
                        <Link
                          to={path}
                          className="queue-ref-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {formatRef(row)}
                        </Link>
                      </td>
                      <td className="queue-col-premises">
                        <div className="queue-premises-name">{row.premises_name || '—'}</div>
                        {row.postcode && (
                          <div className="queue-premises-postcode">{row.postcode}</div>
                        )}
                        {row.address_line_1 && (
                          <div className="queue-premises-address">{row.address_line_1}</div>
                        )}
                      </td>
                      <td className="queue-col-sections">
                        {Array.isArray(row.sections) && row.sections.length > 0 ? (
                          <div className="queue-sections">
                            {row.sections.map((s) => (
                              <span key={s.slug} className="section-pill">{s.name}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="queue-unassigned">—</span>
                        )}
                      </td>
                      <td className="queue-col-status">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="queue-col-assigned">
                        {row.assigned_user_id === session.user_id
                          ? <span className="queue-assigned-me">You</span>
                          : row.assigned_user_name
                            ? <span className="queue-assigned-other">{row.assigned_user_name}</span>
                            : (
                              <button
                                type="button"
                                className="queue-assign-me-btn"
                                disabled={assigningId === row.id}
                                onClick={(e) => handleSelfAssign(e, row.id)}
                              >
                                {assigningId === row.id ? '…' : 'Assign to me'}
                              </button>
                            )}
                      </td>
                      <td className="queue-col-applicant">
                        {row.applicant_name || row.applicant_email || '—'}
                      </td>
                      <td className="queue-col-date">{formatShortDate(row.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
