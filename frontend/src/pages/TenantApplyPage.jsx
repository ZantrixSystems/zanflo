import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import Layout from '../components/Layout.jsx';

export default function TenantApplyPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [applicationTypes, setApplicationTypes] = useState([]);
  const [error, setError] = useState('');
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [startingTypeId, setStartingTypeId] = useState(null);

  useEffect(() => {
    api.getApplicationTypes()
      .then((data) => setApplicationTypes(data.application_types))
      .catch((err) => setError(err.message || 'Could not load application types.'))
      .finally(() => setLoadingTypes(false));
  }, []);

  async function startApplication(typeId) {
    if (!session) return;

    setError('');
    setStartingTypeId(typeId);
    try {
      const application = await api.createApplication({ application_type_id: typeId });
      navigate(`/applications/${application.id}`);
    } catch (err) {
      setError(err.message || 'Could not start application.');
      setStartingTypeId(null);
    }
  }

  if (loading || loadingTypes) {
    return (
      <Layout>
        <div className="spinner">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="form-section">
        <div className="form-section-title">Start an application</div>
        <h1 className="page-title">Choose the licence application you want to begin.</h1>
        <p className="page-subtitle">
          {session
            ? 'Pick an application type to create a draft for this tenant.'
            : 'You need an applicant account before you can start. Sign in or create one, then come straight back here.'}
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {!session && (
          <div className="platform-hero-actions" style={{ marginBottom: 24 }}>
            <Link className="btn btn-primary" to="/register?next=%2Fapply">Create applicant account</Link>
            <Link className="btn btn-secondary" to="/login?next=%2Fapply">Sign in</Link>
          </div>
        )}

        {applicationTypes.length === 0 ? (
          <p className="empty-state">No application types are available for this tenant yet.</p>
        ) : (
          <div className="app-type-grid">
            {applicationTypes.map((type) => (
              <button
                key={type.id}
                className="app-type-card"
                type="button"
                onClick={() => startApplication(type.id)}
                disabled={!session || startingTypeId === type.id}
              >
                <div className="app-type-card-title">
                  {startingTypeId === type.id ? 'Starting...' : type.name}
                </div>
                {type.description && (
                  <div className="app-type-card-desc">{type.description}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
