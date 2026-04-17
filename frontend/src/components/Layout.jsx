import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';

export default function Layout({
  children,
  session: explicitSession,
  onSignOut,
  brandTarget: explicitBrandTarget,
  signOutTarget = '/login',
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
            <span style={{ fontSize: '.875rem', color: 'var(--color-text)' }}>
              {session.full_name}
            </span>
            <button onClick={handleLogout}>Sign out</button>
          </nav>
        )}
      </header>
      <main className="layout-main">
        {children}
      </main>
    </div>
  );
}
