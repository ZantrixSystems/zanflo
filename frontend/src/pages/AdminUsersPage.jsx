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

const EMPTY_EDIT = {
  full_name: '',
  role: 'officer',
  password: '',
};

function EditUserModal({ user, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    role: user.role,
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  function setField(field, value) {
    setForm((c) => ({ ...c, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setLocalError('');

    const payload = {};
    if (form.full_name.trim()) payload.full_name = form.full_name.trim();
    if (form.role) payload.role = form.role;
    if (form.password) payload.password = form.password;

    try {
      await api.updateAdminUser(user.id, payload);
      onSaved();
    } catch (err) {
      setLocalError(err.message || 'Could not update user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2 className="profile-modal-title">Edit user</h2>
          <button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {localError && <div className="alert alert-error">{localError}</div>}

        <form onSubmit={handleSubmit} noValidate>
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
            <label htmlFor="edit-role">Role</label>
            <select id="edit-role" value={form.role} onChange={(e) => setField('role', e.target.value)}>
              <option value="tenant_admin">Tenant admin</option>
              <option value="manager">Manager</option>
              <option value="officer">Officer</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="edit-password">New password</label>
            <input
              id="edit-password"
              type="password"
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              autoComplete="new-password"
              placeholder="Leave blank to keep current password"
            />
            <span className="form-hint">At least 8 characters, one uppercase letter, one number.</span>
          </div>

          <div className="platform-hero-actions" style={{ marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  async function loadUsers() {
    const data = await api.listAdminUsers();
    setUsers(data.users ?? []);
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
                  <div className="application-row-meta">{user.email} &middot; {user.role.replace('_', ' ')}</div>
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
            <input id="user-email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="user-name">Full name</label>
            <input id="user-name" value={form.full_name} onChange={(event) => updateField('full_name', event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="user-role">Role</label>
            <select id="user-role" value={form.role} onChange={(event) => updateField('role', event.target.value)}>
              <option value="tenant_admin">Tenant admin</option>
              <option value="manager">Manager</option>
              <option value="officer">Officer</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="user-password">Password</label>
            <input id="user-password" type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} autoComplete="new-password" />
            <span className="form-hint">Staff sign in with their email address. At least 12 characters required for new accounts.</span>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Create user'}
          </button>
        </form>
      </section>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handleEditSaved}
          onError={(msg) => { setError(msg); setEditingUser(null); }}
        />
      )}
    </AdminLayout>
  );
}
