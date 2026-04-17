import { useState } from 'react';
import Layout from '../components/Layout.jsx';

function normaliseSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
}

export default function ApexCouncilSignInPage() {
  const [slug, setSlug] = useState('');

  const cleanedSlug = normaliseSlug(slug);

  function continueToCouncilAdmin() {
    if (!cleanedSlug) return;
    window.location.href = `https://${cleanedSlug}.zanflo.com/admin`;
  }

  return (
    <Layout>
      <section className="form-section">
        <div className="form-section-title">Council sign in</div>
        <h1 className="page-title">Go to your council sign-in page</h1>
        <p className="page-subtitle">
          Each council gets its own web address. Enter your council subdomain and we will take you to your council&apos;s staff sign-in page.
        </p>
      </section>

      <section className="form-section">
        <div className="form-group">
          <label htmlFor="council-slug">Council subdomain</label>
          <div className="subdomain-input-row">
            <input
              id="council-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="riverside"
              autoComplete="off"
            />
            <span className="subdomain-suffix">.zanflo.com</span>
          </div>
          <span className="form-hint">
            Example: if your council site is <strong>riverside.zanflo.com</strong>, enter <strong>riverside</strong>.
          </span>
        </div>

        <div className="platform-hero-actions">
          <button type="button" className="btn btn-primary" onClick={continueToCouncilAdmin} disabled={!cleanedSlug}>
            Continue to council sign in
          </button>
          <a className="btn btn-secondary" href="/">
            Back to main site
          </a>
        </div>
      </section>
    </Layout>
  );
}
