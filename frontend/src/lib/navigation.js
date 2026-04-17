export function buildTenantAdminNav(session) {
  const items = [
    { to: '/admin/dashboard', label: 'Dashboard' },
  ];

  if (session && ['officer', 'manager'].includes(session.role)) {
    items.push({ to: '/admin/applications', label: 'Applications' });
  }

  if (session?.role === 'tenant_admin') {
    items.push(
      { to: '/admin/application-setup', label: 'Application setup' },
      { to: '/admin/users', label: 'Users' },
      { to: '/admin/settings', label: 'Settings' },
      { to: '/admin/audit', label: 'Audit' },
      { href: '/', label: 'Public site' },
    );
  }

  return items;
}

export function buildApplicantNav(session) {
  const items = [
    { to: '/', label: 'Home' },
    { to: '/premises', label: 'Premises' },
    { to: '/apply', label: 'Start application' },
  ];

  if (session) {
    items.push({ to: '/dashboard', label: 'My applications' });
  } else {
    items.push(
      { to: '/register?next=%2Fapply', label: 'Create account' },
      { to: '/login?next=%2Fapply', label: 'Sign in' },
    );
  }

  return items;
}
