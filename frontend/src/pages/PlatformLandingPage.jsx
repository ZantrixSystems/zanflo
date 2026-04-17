import Layout from '../components/Layout.jsx';

export default function PlatformLandingPage() {
  return (
    <Layout>
      <div className="platform-hero">
        <div className="platform-hero-copy">
          <div className="section-heading">Council Licensing Platform</div>
          <h1 className="page-title platform-hero-title">
            Multi-tenant licensing for councils and other public-sector organisations.
          </h1>
          <p className="page-subtitle platform-hero-subtitle">
            Zanflo gives each council its own public applicant portal, staff workspace, and isolated tenant boundary.
          </p>
          <div className="platform-hero-actions">
            <a className="btn btn-primary" href="#how-it-works">See how it works</a>
            <a className="btn btn-secondary" href="https://platform.zanflo.com/login">Platform admin sign in</a>
          </div>
        </div>

        <div className="platform-hero-panel form-section">
          <div className="form-section-title">URL Strategy</div>
          <div className="platform-url-list">
            <div className="platform-url-item">
              <strong>zanflo.com</strong>
              <span>Product website and product overview only.</span>
            </div>
            <div className="platform-url-item">
              <strong>platform.zanflo.com</strong>
              <span>Internal platform administration area.</span>
            </div>
            <div className="platform-url-item">
              <strong>&lt;tenant&gt;.zanflo.com</strong>
              <span>Tenant public portal for applicants, with staff entry at /admin.</span>
            </div>
          </div>
        </div>
      </div>

      <section className="form-section">
        <div className="form-section-title">What It Is</div>
        <div className="platform-two-column">
          <p className="platform-body-copy">
            ZanFlo is a shared licensing platform for councils and similar public-sector organisations.
            Each council operates within its own tenant boundary, with separate data, users, and public-facing hostname.
          </p>
          <p className="platform-body-copy">
            Manual tenant onboarding remains the MVP path. Self-service tenant provisioning is not part of the active runtime.
          </p>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-title">Key Benefits</div>
        <div className="platform-feature-grid">
          <article className="platform-feature-card">
            <h2>Tenant isolation from day one</h2>
            <p>Each council runs independently on the same platform without data leakage across tenants.</p>
          </article>
          <article className="platform-feature-card">
            <h2>Clear public and admin entry points</h2>
            <p>Applicants use the tenant public portal while staff and platform admins use dedicated sign-in areas.</p>
          </article>
          <article className="platform-feature-card">
            <h2>MVP-ready operating model</h2>
            <p>Manual onboarding, fixed workflow states, and audit-first mutations keep delivery practical and safe.</p>
          </article>
        </div>
      </section>

      <section className="form-section" id="how-it-works">
        <div className="form-section-title">How It Works</div>
        <div className="platform-steps">
          <div className="platform-step">
            <span className="platform-step-number">01</span>
            <div>
              <h2>Platform team provisions the tenant</h2>
              <p>A platform admin creates the tenant, assigns its hostname, and issues the initial break-glass admin account.</p>
            </div>
          </div>
          <div className="platform-step">
            <span className="platform-step-number">02</span>
            <div>
              <h2>Council staff use their own tenant domain</h2>
              <p>Applicants use the tenant public site. Council staff and tenant admins sign in at that tenant&apos;s /admin route.</p>
            </div>
          </div>
          <div className="platform-step">
            <span className="platform-step-number">03</span>
            <div>
              <h2>Applicant and staff journeys stay separate</h2>
              <p>The public portal focuses on applications. Platform-level administration stays on platform.zanflo.com.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="form-section" id="existing-users">
        <div className="form-section-title">Entry Points</div>
        <div className="platform-guidance-grid">
          <article className="platform-guidance-card">
            <h2>Applicants and council staff</h2>
            <p>Use the tenant-specific hostname. Applicants start on the public homepage, and staff sign in at /admin.</p>
          </article>
          <article className="platform-guidance-card">
            <h2>Platform administrators</h2>
            <p>Use `platform.zanflo.com/login` for internal platform administration once your access has been issued.</p>
          </article>
        </div>
      </section>
    </Layout>
  );
}
