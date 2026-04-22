import { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout.jsx';
import { api } from '../api.js';
import { useStaffAuth } from '../components/RequireStaffAuth.jsx';

const EMPTY_FORM = {
  email: '',
  full_name: '',
  role: 'officer',
  password: '',
};

function EditUserModal({ user, customRoles, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    role: user.role,
    password: '',
    custom_role_id: user.custom_role_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField(field, value) {
    setForm((c) => ({ ...c, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {};
    if (form.full_name.trim()) payload.full_name = form.full_name.trim();
    if (form.role) payload.role = form.role;
    if (form.password) payload.password = form.password;
    payload.custom_role_id = form.custom_role_id || null;

    try {
      await api.updateAdminUser(user.id, payload);
      onSaved();
    } catch (err) {
      setError(err.message || 'Could not update user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit user</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="edit-name">Full name</label>
              <input
                id="edit-name"
                value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)}
                placeholder={user.full_name}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-role">Built-in role</label>
              <select id="edit-role" value={form.role} onChange={(e) => setField('role', e.target.value)}>
                <option value="tenant_admin">Tenant admin</option>
                <option value="manager">Manager</option>
                <option value="officer">Officer</option>
              </select>
              <span className="form-hint">Built-in roles define base access. Tenant admins always have full access.</span>
            </div>

            {customRoles.length > 0 && (
              <div className="form-group">
                <label htmlFor="edit-custom-role">Custom role <span className="form-hint-inline">(optional)</span></label>
                <select
                  id="edit-custom-role"
                  value={form.custom_role_id}
                  onChange={(e) => setField('custom_role_id', e.target.value)}
                >
                  <option value="">None — use built-in role defaults</option>
                  {customRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <span className="form-hint">
                  Assigning a custom role overrides the permission set for this user.
                  {form.role === 'tenant_admin' && ' Tenant admins ignore custom role permissions — they always have full access.'}
                </span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="edit-password">New password <span className="form-hint-inline">(optional)</span></label>
              <input
                id="edit-password"
                type="password"
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                autoComplete="new-password"
                placeholder="Leave blank to keep current password"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { session, logout, refresh } = useStaffAuth();
  const [users, setUsers] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  async function loadUsers() {
    const data = await api.listAdminUsers();
    setUsers(data.users ?? []);
    setCustomRoles(data.custom_roles ?? []);
  }

  useEffect(() => {
    loadUsers()
      .catch((err) => setError(err.message || 'Could not load users.'))
      .finally(() => setLoading(false));
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.createAdminUser(form);
      setForm(EMPTY_FORM);
      setNotice('User created.');
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Could not create user.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSaved() {
    setEditingUser(null);
    setNotice('User updated.');
    setError('');
    await loadUsers();
  }

  function roleLabel(user) {
    const builtIn = user.role.replace('_', ' ');
    if (user.custom_role_name) return `${builtIn} · ${user.custom_role_name}`;
    return builtIn;
  }

  return (
    <AdminLayout
      session={session}
      onSignOut={logout}
      onSessionRefresh={refresh}
      breadcrumbs={[
        { to: '/admin/dashboard', label: 'Council admin' },
        { label: 'Users' },
      ]}
    >
      <section className="form-section">
        <div className="form-section-title">Tenant administration</div>
        <h1 className="page-title">Users</h1>
        <p className="page-subtitle">Manage tenant staff access for this council only.</p>
        {customRoles.length === 0 && (
          <p className="page-subtitle" style={{ marginTop: 8 }}>
            No custom roles yet — <a href="/admin/settings/roles" style={{ color: 'var(--color-primary)' }}>create one in Settings</a> to assign granular permissions.
          </p>
        )}
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="form-section">
        <div className="form-section-title">Current users</div>
        {loading ? (
          <div className="spinner">Loading...</div>
        ) : users.length === 0 ? (
          <p className="empty-state">No tenant users found.</p>
        ) : (
          <div className="application-list">
            {users.map((user) => (
              <div key={user.id} className="application-row">
                <div className="application-row-main">
                  <div className="application-row-title">{user.full_name || user.email}</div>
                  <div className="application-row-meta">
                    {user.email} &middot; {roleLabel(user)}
                  </div>
                </div>
                <div className="platform-hero-actions" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setError(''); setNotice(''); setEditingUser(user); }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="form-section">
        <div className="form-section-title">Add user</div>
        <form onSubmit={handleCreate} noValidate>
          <div className="form-group">
            <label htmlFor="user-email">Email</label>
            <input id="user-email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="user-name">Full name</label>
            <input id="user-name" value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="user-role">Role</label>
            <select id="user-role" value={form.role} onChange={(e) => updateField('role', e.target.value)}>
              <option value="tenant_admin">Tenant admin</option>
              <option value="manager">Manager</option>
              <option value="officer">Officer</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="user-password">Password</label>
            <input id="user-password" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} autoComplete="new-password" />
            <span className="form-hint">At least 12 characters required for new accounts.</span>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create user'}
          </button>
        </form>
      </section>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          customRoles={customRoles}
          onClose={() => setEditingUser(null)}
          onSaved={handleEditSaved}
        />
      )}
    </AdminLayout>
  );
}
