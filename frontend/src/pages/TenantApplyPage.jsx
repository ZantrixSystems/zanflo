import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import Layout from '../components/Layout.jsx';
import { buildApplicantNav } from '../lib/navigation.js';

export default function TenantApplyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading } = useAuth();
  const [applicationTypes, setApplicationTypes] = useState([]);
  const [premises, setPremises] = useState([]);
  const [error, setError] = useState('');
  const [loadingState, setLoadingState] = useState(true);
  const [startingKey, setStartingKey] = useState('');
  const [selectedPremisesId, setSelectedPremisesId] = useState(searchParams.get('premises') || '');

  useEffect(() => {
    async function loadPage() {
      try {
        const [typesData, premisesData] = await Promise.all([
          api.getApplicationTypes(),
          session ? api.listPremises() : Promise.resolve({ premises: [] }),
        ]);
        setApplicationTypes(typesData.application_types ?? []);
        setPremises(premisesData.premises ?? []);
        if (!selectedPremisesId && premisesData.premises?.length === 1) {
          setSelectedPremisesId(premisesData.premises[0].id);
        }
      } catch (err) {
        setError(err.message || 'Could not load the application start page.');
      } finally {
        setLoadingState(false);
      }
    }

    loadPage();
  }, [searchParams, session, selectedPremisesId]);

  async function startApplication(typeId) {
    if (!session || !selectedPremisesId) return;

    setError('');
    setStartingKey(`${selectedPremisesId}:${typeId}`);
    try {
      const application = await api.createApplication({
        application_type_id: typeId,
        premises_id: selectedPremisesId,
      });
      navigate(`/applications/${application.id}`);
    } catch (err) {
      setError(err.message || 'Could not start application.');
      setStartingKey('');
    }
  }

  const selectedPremises = premises.find((row) => row.id === selectedPremisesId);

  if (loading || loadingState) {
    return (
      <Layout>
        <div className="spinner">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout
      breadcrumbs={[
        { to: '/', label: 'Applicant portal' },
        { label: 'Start application' },
      ]}
      navItems={buildApplicantNav(session)}
    >
      <section className="form-section">
        <div className="form-section-title">Start application</div>
        <h1 className="page-title">Choose a premises first</h1>
        <p className="page-subtitle">
          {session
            ? 'Applications now start from an existing premises record so you can reuse the same site details later.'
            : 'You need an applicant account before you can manage premises or start an application.'}
        </p>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      {!session && (
        <section className="form-section">
          <div className="platform-hero-actions">
            <Link className="btn btn-primary" to="/register?next=%2Fpremises">Create applicant account</Link>
            <Link className="btn btn-secondary" to="/login?next=%2Fpremises">Sign in</Link>
          </div>
        </section>
      )}

      {session && premises.length === 0 && (
        <section className="form-section">
          <div className="form-section-title">No premises yet</div>
          <p className="platform-body-copy">
            Add your premises record first. Once it exists, you can use it for this application and future ones.
          </p>
          <div className="platform-hero-actions" style={{ marginTop: 16 }}>
            <Link className="btn btn-primary" to="/premises/new?returnTo=apply">Create premises</Link>
            <Link className="btn btn-secondary" to="/premises">Open premises list</Link>
          </div>
        </section>
      )}

      {session && premises.length > 0 && (
        <>
          <section className="form-section">
            <div className="form-section-title">1. Select premises</div>
            <div className="form-group">
              <label htmlFor="premises_select">Premises</label>
              <select
                id="premises_select"
                value={selectedPremisesId}
                onChange={(event) => setSelectedPremisesId(event.target.value)}
              >
                <option value="">Select a premises</option>
                {premises.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.premises_name} - {[row.address_line_1, row.postcode].filter(Boolean).join(', ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="platform-hero-actions" style={{ marginTop: 16 }}>
              <Link className="btn btn-secondary" to="/premises">Manage premises</Link>
              {selectedPremises && (
                <Link className="btn btn-secondary" to={`/premises/${selectedPremises.id}?returnTo=apply&premises=${selectedPremises.id}`}>
                  Edit selected premises
                </Link>
              )}
            </div>

            {selectedPremises && (
              <div className="soft-panel" style={{ marginTop: 20 }}>
                <div className="form-section-title">Selected premises</div>
                <p className="platform-body-copy"><strong>{selectedPremises.premises_name}</strong></p>
                <p className="platform-body-copy">
                  {[selectedPremises.address_line_1, selectedPremises.address_line_2, selectedPremises.town_or_city, selectedPremises.postcode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {selectedPremises.premises_description && (
                  <p className="platform-body-copy">{selectedPremises.premises_description}</p>
                )}
              </div>
            )}
          </section>

          <section className="form-section">
            <div className="form-section-title">2. Choose application type</div>
            {applicationTypes.length === 0 ? (
              <p className="empty-state">No application types are available for this tenant yet.</p>
            ) : (
              <div className="app-type-grid">
                {applicationTypes.map((type) => {
                  const currentKey = `${selectedPremisesId}:${type.id}`;
                  return (
                    <button
                      key={type.id}
                      className="app-type-card"
                      type="button"
                      onClick={() => startApplication(type.id)}
                      disabled={!selectedPremisesId || startingKey === currentKey}
                    >
                      <div className="app-type-card-title">
                        {startingKey === currentKey ? 'Starting...' : type.name}
                      </div>
                      {type.description && (
                        <div className="app-type-card-desc">{type.description}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
