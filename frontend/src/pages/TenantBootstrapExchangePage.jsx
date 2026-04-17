import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';

export default function TenantBootstrapExchangePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Bootstrap link is missing its token.');
      return;
    }

    api.staffBootstrapExchange({ token })
      .then((data) => {
        const target = data.session?.role === 'tenant_admin' ? '/admin/settings?setup=1' : '/admin/dashboard';
        navigate(target, { replace: true });
      })
      .catch((err) => {
        setError(err.message || 'Bootstrap sign-in failed.');
      });
  }, [navigate, searchParams]);

  return (
    <Layout>
      <div className="auth-page platform-auth-page">
        <div className="auth-card">
          <h1>Setting up your council workspace</h1>
          <p className="auth-subtitle">
            We are finishing your first secure sign-in on this council&apos;s own site.
          </p>
          {error ? <div className="alert alert-error">{error}</div> : <div className="spinner">Signing you in...</div>}
        </div>
      </div>
    </Layout>
  );
}
