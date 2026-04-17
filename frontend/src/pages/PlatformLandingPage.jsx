import Layout from '../components/Layout.jsx';

export default function PlatformLandingPage() {
  return (
    <Layout>
      <div className="platform-hero">
        <div className="platform-hero-copy">
          <div className="section-heading">Council Licensing Platform</div>
          <h1 className="page-title platform-hero-title">
            Start your council licensing service in minutes.
          </h1>
          <p className="page-subtitle platform-hero-subtitle">
            Start a 30-day trial with email and password. Choose your council subdomain, create your workspace straight away, and configure single sign-on later if you need it.
          </p>
          <div className="platform-hero-actions">
            <a className="btn btn-primary" href="/signup">Council sign up</a>
            <a className="btn btn-secondary" href="/council-sign-in">Council sign in</a>
          </div>
        </div>

        <div className="platform-hero-panel form-section">
          <div className="form-section-title">How your council address works</div>
          <div className="platform-url-list">
            <div className="platform-url-item">
              <strong>zanflo.com</strong>
              <span>Main Zanflo website for councils starting or returning to their setup.</span>
            </div>
            <div className="platform-url-item">
              <strong>riverside.zanflo.com</strong>
              <span>Your council will get its own address, like riverside.zanflo.com, which your staff and applicants will use.</span>
            </div>
            <div className="platform-url-item">
              <strong>riverside.zanflo.com/admin</strong>
              <span>Your council staff and tenant admin sign in on the same council-specific site.</span>
            </div>
          </div>
        </div>
      </div>

      <section className="form-section">
        <div className="form-section-title">What councils get</div>
        <div className="platform-feature-grid">
          <article className="platform-feature-card">
            <h2>Instant council workspace</h2>
            <p>Sign up directly, choose your council URL, and start configuring your service immediately.</p>
          </article>
          <article className="platform-feature-card">
            <h2>No SSO required to start</h2>
            <p>Use local admin login during the trial. Add SSO later when your council is ready.</p>
          </article>
          <article className="platform-feature-card">
            <h2>Trial ready</h2>
            <p>Your 30-day trial includes tenant setup, public portal branding, applicant accounts, and the premises licence journey.</p>
          </article>
        </div>
      </section>

      <section className="form-section" id="how-it-works">
        <div className="form-section-title">How it works</div>
        <div className="platform-steps">
          <div className="platform-step">
            <span className="platform-step-number">01</span>
            <div>
              <h2>Sign up your council</h2>
              <p>Enter your council name, admin details, and bootstrap password to create your trial workspace.</p>
            </div>
          </div>
          <div className="platform-step">
            <span className="platform-step-number">02</span>
            <div>
              <h2>Choose your council URL</h2>
              <p>Pick the subdomain your council will use, such as riverside.zanflo.com.</p>
            </div>
          </div>
          <div className="platform-step">
            <span className="platform-step-number">03</span>
            <div>
              <h2>Access your admin dashboard</h2>
              <p>Sign in to your council admin area straight away using the local bootstrap account created during signup.</p>
            </div>
          </div>
          <div className="platform-step">
            <span className="platform-step-number">04</span>
            <div>
              <h2>Configure your service and settings</h2>
              <p>Set your branding, homepage content, support details, and optional SSO settings when you are ready.</p>
            </div>
          </div>
          <div className="platform-step">
            <span className="platform-step-number">05</span>
            <div>
              <h2>Start receiving applications</h2>
              <p>Applicants use your council site to create accounts and begin a premises licence application online.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-title">Trial details</div>
        <div className="platform-two-column">
          <p className="platform-body-copy">
            Start with a 30-day trial. You can use local login from day one, so single sign-on is optional and can be configured later.
          </p>
          <p className="platform-body-copy">
            During the trial, your council can set up its portal, invite a small staff team, and begin taking applications straight away.
          </p>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-title">Trust and security</div>
        <div className="platform-two-column">
          <p className="platform-body-copy">
            Councils and applicants do not share the same tenant data. Tenant resolution happens in the backend and each request is checked against the current host and session.
          </p>
          <p className="platform-body-copy">
            High-privilege changes are validated server-side and written to audit logs. Your first local admin account is kept as a break glass path for setup and recovery.
          </p>
        </div>
      </section>
    </Layout>
  );
}
