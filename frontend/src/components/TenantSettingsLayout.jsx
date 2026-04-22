import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useStaffAuth } from './RequireStaffAuth.jsx';

const SETTINGS_NAV = [
  {
    group: 'Organisation',
    items: [
      { to: '/admin/settings/general', label: 'General', description: 'Name, contact, branding' },
      { to: '/admin/settings/public-site', label: 'Public site', description: 'Homepage and applicant messages' },
      { to: '/admin/settings/sso', label: 'Single sign-on', description: 'SAML and OIDC configuration' },
    ],
  },
  {
    group: 'Team',
    items: [
      { to: '/admin/users', label: 'Users', description: 'Add and manage staff' },
      { to: '/admin/settings/roles', label: 'Roles & permissions', description: 'Custom roles and access control' },
    ],
  },
  {
    group: 'Licensing',
    items: [
      { to: '/admin/licence-sections', label: 'Licence sections', description: 'Configure application form sections' },
    ],
  },
  {
    group: 'Platform',
    items: [
      { to: '/admin/audit', label: 'Audit log', description: 'Record of all mutations' },
    ],
  },
];

export default function TenantSettingsLayout({ children, title, description }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout } = useStaffAuth();

  async function handleBack() {
    navigate('/admin/dashboard');
  }

  return (
    <div className="settings-shell">
      <div className="settings-shell-topbar">
        <button type="button" className="settings-back-btn" onClick={handleBack}>
          ← Back to dashboard
        </button>
        <div className="settings-shell-org">
          <span className="settings-shell-org-label">Settings</span>
          <span className="settings-shell-org-name">{session?.council_name || 'Council'}</span>
        </div>
        <button type="button" className="settings-shell-signout" onClick={logout}>
          Sign out
        </button>
      </div>

      <div className="settings-shell-body">
        <aside className="settings-sidebar">
          {SETTINGS_NAV.map((group) => (
            <div key={group.group} className="settings-nav-group">
              <div className="settings-nav-group-label">{group.group}</div>
              {group.items.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`settings-nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className="settings-nav-item-label">{item.label}</span>
                    <span className="settings-nav-item-desc">{item.description}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </aside>

        <div className="settings-content">
          {title && (
            <div className="settings-content-header">
              <h1 className="settings-content-title">{title}</h1>
              {description && <p className="settings-content-desc">{description}</p>}
            </div>
          )}
          <div className="settings-content-body">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
