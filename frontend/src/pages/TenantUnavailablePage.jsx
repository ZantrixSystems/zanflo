import Layout from '../components/Layout.jsx';

export default function TenantUnavailablePage() {
  return (
    <Layout>
      <section className="form-section">
        <div className="form-section-title">Tenant unavailable</div>
        <h1 className="page-title">Tenant not found</h1>
        <p className="page-subtitle">
          This council site does not exist, has been deleted, or is not currently active.
        </p>
        <p className="platform-body-copy">
          Check the web address and try again. If you were expecting this council portal to be available, contact the platform administrator or return to the main Zanflo site.
        </p>
        <div className="platform-hero-actions" style={{ marginTop: 24 }}>
          <a className="btn btn-primary" href="https://zanflo.com">
            Go to zanflo.com
          </a>
        </div>
      </section>
    </Layout>
  );
}
