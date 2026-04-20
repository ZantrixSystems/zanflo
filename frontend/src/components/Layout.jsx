import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';

export default function Layout({
  children,
  session: explicitSession,
  onSignOut,
  brandTarget: explicitBrandTarget,
  signOutTarget = '/login',
  breadcrumbs = [],
  navItems = [],
}) {
  const applicantAuth = useAuth();
  const session = explicitSession ?? applicantAuth.session;
  const logout = onSignOut ?? applicantAuth.logout;
  const navigate = useNavigate();
  const hostname = window.location.hostname.toLowerCase();
  const isApexHost = hostname === 'zanflo.com' || hostname === 'www.zanflo.com';
  const isPlatformHost = hostname === 'platform.zanflo.com';
  const brandTarget = explicitBrandTarget ?? (isApexHost || isPlatformHost ? '/' : '/dashboard');

  async function handleLogout() {
    await logout();
    navigate(signOutTarget);
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <Link to={brandTarget} className="layout-header-brand">
          ZanFlo
        </Link>
        {session && (
          <nav className="layout-header-nav">
            {session.role ? (
              <span style={{ fontSize: '.875rem', color: 'var(--color-text)' }}>
                {session.full_name}
              </span>
            ) : (
              <Link to="/profile" style={{ fontSize: '.875rem', color: 'var(--color-text)' }}>
                {session.full_name}
              </Link>
            )}
            <button onClick={handleLogout}>Sign out</button>
          </nav>
        )}
      </header>
      <main className="layout-main">
        {(breadcrumbs.length > 0 || navItems.length > 0) && (
          <div className="layout-shell">
            {breadcrumbs.length > 0 && (
              <nav className="layout-breadcrumbs" aria-label="Breadcrumb">
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1;

                  return (
                    <span key={`${crumb.label}-${index}`} className="layout-breadcrumb-item">
                      {!isLast && crumb.to ? (
                        <Link to={crumb.to}>{crumb.label}</Link>
                      ) : (
                        <span>{crumb.label}</span>
                      )}
                      {!isLast && <span className="layout-breadcrumb-separator">/</span>}
                    </span>
                  );
                })}
              </nav>
            )}

            {navItems.length > 0 && (
              <nav className="layout-section-nav" aria-label="Section navigation">
                {navItems.map((item) => {
                  if (item.href) {
                    return (
                      <a key={item.label} href={item.href} className="layout-section-link">
                        {item.label}
                      </a>
                    );
                  }

                  return (
                    <Link key={item.label} to={item.to} className="layout-section-link">
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
