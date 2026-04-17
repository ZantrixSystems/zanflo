import { Link } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';
import Layout from '../components/Layout.jsx';

export default function TenantPublicHomePage() {
  const { session } = useAuth();

  return (
    <Layout>
      <div className="platform-hero">
        <div className="platform-hero-copy">
          <div className="section-heading">Licensing portal</div>
          <h1 className="page-title platform-hero-title">
            Apply for licences, track progress, and respond to council requests.
          </h1>
          <p className="page-subtitle platform-hero-subtitle">
            This page is for applicants. Council staff should use the staff sign-in area for this tenant.
          </p>
          <div className="platform-hero-actions">
            <Link className="btn btn-primary" to="/apply">Start an application</Link>
            <Link className="btn btn-secondary" to={session ? '/dashboard' : '/login?next=%2Fdashboard'}>
              {session ? 'View your applications' : 'Sign in'}
            </Link>
          </div>
        </div>

        <div className="platform-hero-panel form-section">
          <div className="form-section-title">Before you start</div>
          <p className="platform-body-copy">
            You can create an applicant account, save a draft, come back later, and check your application status.
          </p>
          <p className="platform-body-copy">
            Council staff and tenant admins should go to <strong>/admin</strong> on this same tenant domain.
          </p>
        </div>
      </div>

      <section className="form-section">
        <div className="form-section-title">What you can do here</div>
        <div className="platform-feature-grid">
          <article className="platform-feature-card">
            <h2>Start online</h2>
            <p>Begin a new application from one public entry point and save it as a draft.</p>
          </article>
          <article className="platform-feature-card">
            <h2>Track status</h2>
            <p>See whether your application is still a draft, submitted, under review, or awaiting information.</p>
          </article>
          <article className="platform-feature-card">
            <h2>Return later</h2>
            <p>Sign back in to continue a draft or review previous submissions for this tenant.</p>
          </article>
        </div>
      </section>
    </Layout>
  );
}
