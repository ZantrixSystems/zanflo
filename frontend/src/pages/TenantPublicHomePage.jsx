import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { buildApplicantNav } from '../lib/navigation.js';

export default function TenantPublicHomePage() {
  const { session } = useAuth();
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    api.getTenantPublicConfig()
      .then((data) => setTenant(data.tenant))
      .catch(() => setTenant(null));
  }, []);

  const councilName = tenant?.display_name || 'your council';

  return (
    <Layout navItems={buildApplicantNav(session)} fullWidth>
      {/* Hero */}
      <section className="pub-hero">
        <div className="pub-hero-inner">
          <div className="pub-hero-copy">
            <div className="pub-hero-eyebrow">Licensing portal</div>
            <h1 className="pub-hero-title">
              {tenant?.welcome_text || `Apply for a premises licence online`}
            </h1>
            <p className="pub-hero-subtitle">
              {tenant?.public_homepage_text ||
                'Register your premises, select the licences you need, and track your application — all in one place.'}
            </p>
            <div className="pub-hero-actions">
              <Link className="btn btn-primary" to="/apply">Start an application</Link>
              <Link className="btn btn-secondary" to={session ? '/dashboard' : '/register?next=%2Fpremises'}>
                {session ? 'View in progress' : 'Create an account'}
              </Link>
            </div>
          </div>
          <div className="pub-hero-aside">
            <div className="pub-info-card">
              <div className="pub-info-card-title">Before you start</div>
              <p>
                This portal is run by <strong>{councilName}</strong>. You will need to create an applicant account to save your progress and submit.
              </p>
              <p>
                Council staff should sign in via <strong>/admin</strong>.
              </p>
              {(tenant?.support_email || tenant?.support_phone || tenant?.support_contact_name) && (
                <div className="pub-info-contact">
                  <div className="pub-info-contact-label">Contact</div>
                  {tenant.support_contact_name && <div>{tenant.support_contact_name}</div>}
                  {tenant.support_email && <div>{tenant.support_email}</div>}
                  {tenant.support_phone && <div>{tenant.support_phone}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="pub-steps-section">
        <div className="pub-steps-inner">
          <h2 className="pub-section-title">How it works</h2>
          <div className="pub-steps">
            <div className="pub-step">
              <div className="pub-step-num">1</div>
              <div className="pub-step-body">
                <h3>Create your account</h3>
                <p>Register once as an applicant. Your account is separate from council staff logins.</p>
              </div>
            </div>
            <div className="pub-step">
              <div className="pub-step-num">2</div>
              <div className="pub-step-body">
                <h3>Add your premises</h3>
                <p>Register your premises and submit it for council verification. This only needs to be done once.</p>
              </div>
            </div>
            <div className="pub-step">
              <div className="pub-step-num">3</div>
              <div className="pub-step-body">
                <h3>Apply for licences</h3>
                <p>Once verified, choose which licences you need and fill in the relevant sections.</p>
              </div>
            </div>
            <div className="pub-step">
              <div className="pub-step-num">4</div>
              <div className="pub-step-body">
                <h3>Track your case</h3>
                <p>Follow progress, respond to requests, and receive updates as your case moves through review.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact / help */}
      {tenant?.contact_us_text && (
        <section className="pub-contact-section">
          <div className="pub-contact-inner">
            <h2 className="pub-section-title">Need help?</h2>
            <p className="pub-contact-text">{tenant.contact_us_text}</p>
          </div>
        </section>
      )}
    </Layout>
  );
}
