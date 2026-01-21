'use client';

import { useState, useEffect } from 'react';

interface Tenant {
    id: string;
    name: string;
    prefix: string;
    schemaName: string;
    isActive: boolean;
    maxAccounts: number;
    userCount: number;
    accountCount: number;
    createdAt: string;
}

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const [formData, setFormData] = useState({ name: '', prefix: '', maxAccounts: 10 });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchTenants();
    }, []);

    async function fetchTenants() {
        const token = localStorage.getItem('twm_token');
        try {
            const res = await fetch('/api/master/tenants', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setTenants(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch tenants:', err);
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setEditingTenant(null);
        setFormData({ name: '', prefix: '', maxAccounts: 10 });
        setError('');
        setShowModal(true);
    }

    function openEditModal(tenant: Tenant) {
        setEditingTenant(tenant);
        setFormData({ name: tenant.name, prefix: tenant.prefix, maxAccounts: tenant.maxAccounts });
        setError('');
        setShowModal(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError('');

        const token = localStorage.getItem('twm_token');
        const url = editingTenant
            ? `/api/master/tenants/${editingTenant.id}`
            : '/api/master/tenants';
        const method = editingTenant ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to save tenant');
                return;
            }

            setShowModal(false);
            fetchTenants();
        } catch (err) {
            setError('Network error');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(tenant: Tenant) {
        if (!confirm(`Delete ${tenant.name}? This will remove all data for this prefix.`)) return;

        const token = localStorage.getItem('twm_token');
        try {
            await fetch(`/api/master/tenants/${tenant.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchTenants();
        } catch (err) {
            console.error('Failed to delete tenant:', err);
        }
    }

    async function toggleActive(tenant: Tenant) {
        const token = localStorage.getItem('twm_token');
        try {
            await fetch(`/api/master/tenants/${tenant.id}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ isActive: !tenant.isActive }),
            });
            fetchTenants();
        } catch (err) {
            console.error('Failed to toggle tenant:', err);
        }
    }

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
                    <h1 className="text-2xl font-bold text-white">Prefixes / Tenants</h1>
                    <p className="text-slate-400">Manage all prefix instances</p>
                </div>
                <button onClick={openCreateModal} className="btn btn-primary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Prefix
                </button>
            </div>

            {tenants.length === 0 ? (
                <div className="card text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">No prefixes yet</h3>
                    <p className="text-slate-400 mb-4">Create your first prefix to start managing tenants</p>
                    <button onClick={openCreateModal} className="btn btn-primary">
                        Create First Prefix
                    </button>
                </div>
            ) : (
                <div className="card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Prefix</th>
                                <th>Schema</th>
                                <th>Status</th>
                                <th>Users</th>
                                <th>Accounts</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map((tenant) => (
                                <tr key={tenant.id}>
                                    <td className="font-medium text-white">{tenant.name}</td>
                                    <td>
                                        <code className="text-xs bg-slate-700 px-2 py-1 rounded text-indigo-400">
                                            {tenant.prefix}
                                        </code>
                                    </td>
                                    <td className="text-slate-400 text-sm">{tenant.schemaName}</td>
                                    <td>
                                        <button
                                            onClick={() => toggleActive(tenant)}
                                            className={`badge cursor-pointer ${tenant.isActive ? 'badge-success' : 'badge-danger'}`}
                                        >
                                            {tenant.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td>{tenant.userCount}</td>
                                    <td>{tenant.accountCount}</td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openEditModal(tenant)}
                                                className="text-slate-400 hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(tenant)}
                                                className="text-slate-400 hover:text-red-400 transition-colors"
                                                title="Delete"
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
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingTenant ? 'Edit Prefix' : 'Create Prefix'}
                        </h2>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 mb-4 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="My Tenant"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Prefix</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.prefix}
                                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                                    placeholder="my_prefix"
                                    required
                                    disabled={!!editingTenant}
                                    pattern="^[a-z0-9_]+$"
                                />
                                <p className="text-xs text-slate-500 mt-1">Lowercase letters, numbers, and underscores only</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Max Accounts</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={formData.maxAccounts}
                                    onChange={(e) => setFormData({ ...formData, maxAccounts: parseInt(e.target.value) || 10 })}
                                    min={1}
                                    max={100}
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                                    {saving ? <span className="spinner" /> : editingTenant ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
