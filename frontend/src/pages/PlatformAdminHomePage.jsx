import Layout from '../components/Layout.jsx';

export default function PlatformAdminHomePage() {
  return (
    <Layout>
      <section className="form-section platform-admin-shell">
        <div className="form-section-title">Platform Admin</div>
        <h1 className="page-title">Internal platform administration lives here.</h1>
        <p className="page-subtitle">
          This hostname is reserved for platform-level management. Tenant users should use their own council subdomain.
        </p>
        <p className="platform-body-copy">
          The platform admin UI is not built in this slice. This page exists to keep the hostname role explicit and to avoid
          treating `platform.zanflo.com` as a tenant portal by mistake.
        </p>
      </section>
    </Layout>
  );
}
