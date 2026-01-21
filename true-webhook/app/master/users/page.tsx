'use client';

import { useState, useEffect } from 'react';

interface User {
    id: string;
    email: string;
    displayName: string | null;
    role: 'MASTER' | 'TENANT_ADMIN' | 'TENANT_USER';
    tenantId: string | null;
    tenant: { id: string; name: string; prefix: string } | null;
    lastLoginAt: string | null;
    createdAt: string;
}

interface Tenant {
    id: string;
    name: string;
    prefix: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        displayName: '',
        role: 'TENANT_USER' as User['role'],
        tenantId: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const token = localStorage.getItem('twm_token');
        try {
            const [usersRes, tenantsRes] = await Promise.all([
                fetch('/api/master/users', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/master/tenants', { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            if (usersRes.ok) {
                const data = await usersRes.json();
                setUsers(data.data);
            }
            if (tenantsRes.ok) {
                const data = await tenantsRes.json();
                setTenants(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setEditingUser(null);
        setFormData({ email: '', password: '', displayName: '', role: 'TENANT_USER', tenantId: '' });
        setError('');
        setShowModal(true);
    }

    function openEditModal(user: User) {
        setEditingUser(user);
        setFormData({
            email: user.email,
            password: '',
            displayName: user.displayName || '',
            role: user.role,
            tenantId: user.tenantId || '',
        });
        setError('');
        setShowModal(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError('');

        const token = localStorage.getItem('twm_token');
        const url = editingUser ? `/api/master/users/${editingUser.id}` : '/api/master/users';
        const method = editingUser ? 'PUT' : 'POST';

        const body: any = {
            email: formData.email,
            displayName: formData.displayName || undefined,
            role: formData.role,
            tenantId: formData.tenantId || null,
        };
        if (formData.password) {
            body.password = formData.password;
        }

        try {
            const res = await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to save user');
                return;
            }

            setShowModal(false);
            fetchData();
        } catch (err) {
            setError('Network error');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(user: User) {
        if (!confirm(`Delete user ${user.email}?`)) return;

        const token = localStorage.getItem('twm_token');
        try {
            const res = await fetch(`/api/master/users/${user.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok || res.status === 204) {
                fetchData();
            }
        } catch (err) {
            console.error('Failed to delete user:', err);
        }
    }

    const roleColors: Record<User['role'], string> = {
        MASTER: 'badge-warning',
        TENANT_ADMIN: 'badge-success',
        TENANT_USER: 'bg-slate-600/50 text-slate-300',
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Users</h1>
                    <p className="text-slate-400">Manage all user accounts</p>
                </div>
                <button onClick={openCreateModal} className="btn btn-primary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Add User
                </button>
            </div>

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Prefix</th>
                            <th>Last Login</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-sm font-medium">
                                            {user.email.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{user.displayName || user.email}</p>
                                            <p className="text-sm text-slate-400">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`badge ${roleColors[user.role]}`}>
                                        {user.role.replace('_', ' ')}
                                    </span>
                                </td>
                                <td>
                                    {user.tenant ? (
                                        <code className="text-xs bg-slate-700 px-2 py-1 rounded text-indigo-400">
                                            {user.tenant.prefix}
                                        </code>
                                    ) : (
                                        <span className="text-slate-500">—</span>
                                    )}
                                </td>
                                <td className="text-slate-400 text-sm">
                                    {user.lastLoginAt
                                        ? new Date(user.lastLoginAt).toLocaleDateString()
                                        : 'Never'}
                                </td>
                                <td>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="text-slate-400 hover:text-white transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user)}
                                            className="text-slate-400 hover:text-red-400 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingUser ? 'Edit User' : 'Add User'}
                        </h2>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 mb-4 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="input"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Password {editingUser && <span className="text-slate-500">(leave blank to keep current)</span>}
                                </label>
                                <input
                                    type="password"
                                    className="input"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required={!editingUser}
                                    minLength={8}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Display Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.displayName}
                                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                    placeholder="Optional"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <select
                                    className="input"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                                >
                                    <option value="MASTER">Master</option>
                                    <option value="TENANT_ADMIN">Tenant Admin</option>
                                    <option value="TENANT_USER">Tenant User</option>
                                </select>
                            </div>

                            {formData.role !== 'MASTER' && (
                                <div className="form-group">
                                    <label className="form-label">Assign to Prefix</label>
                                    <select
                                        className="input"
                                        value={formData.tenantId}
                                        onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                                    >
                                        <option value="">— Select Prefix —</option>
                                        {tenants.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.prefix})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                                    {saving ? <span className="spinner" /> : editingUser ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
