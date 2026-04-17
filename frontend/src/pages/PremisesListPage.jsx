import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import Layout from '../components/Layout.jsx';
import { buildApplicantNav } from '../lib/navigation.js';

export default function PremisesListPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [premises, setPremises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    api.listPremises()
      .then((data) => setPremises(data.premises ?? []))
      .catch((err) => setError(err.message || 'Could not load your premises.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(event, premisesId) {
    event.preventDefault();
    if (!window.confirm('Delete this premises record?')) return;

    setDeletingId(premisesId);
    setError('');
    try {
      await api.deletePremises(premisesId);
      setPremises((current) => current.filter((row) => row.id !== premisesId));
    } catch (err) {
      setError(err.message || 'Could not delete premises.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Layout
      breadcrumbs={[
        { to: '/', label: 'Applicant portal' },
        { label: 'Premises' },
      ]}
      navItems={buildApplicantNav(session)}
    >
      <section className="form-section">
        <div className="form-section-title">Your premises</div>
        <h1 className="page-title">Manage your premises</h1>
        <p className="page-subtitle">
          Create each premises once, then reuse it when you start a new application for this council.
        </p>
        <div className="platform-hero-actions" style={{ marginTop: 24 }}>
          <Link className="btn btn-primary" to="/premises/new">Add premises</Link>
          <Link className="btn btn-secondary" to="/apply">Start application</Link>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : premises.length === 0 ? (
        <section className="form-section">
          <p className="empty-state">
            You have not added any premises yet.
          </p>
          <div className="platform-hero-actions" style={{ marginTop: 16 }}>
            <Link className="btn btn-primary" to="/premises/new">Create your first premises</Link>
          </div>
        </section>
      ) : (
        <section className="form-section">
          <div className="application-list">
            {premises.map((row) => (
              <Link key={row.id} to={`/premises/${row.id}`} className="application-row">
                <div className="application-row-main">
                  <div className="application-row-title">{row.premises_name}</div>
                  <div className="application-row-meta">
                    {[row.address_line_1, row.town_or_city, row.postcode].filter(Boolean).join(' | ')}
                  </div>
                  <div className="application-row-meta">
                    Linked applications: {row.application_count ?? 0}
                  </div>
                </div>
                <div className="dashboard-action-controls dashboard-action-controls-double">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/apply?premises=${row.id}`);
                    }}
                  >
                    Start application
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={(event) => handleDelete(event, row.id)}
                    disabled={deletingId === row.id}
                  >
                    {deletingId === row.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </Layout>
  );
}
