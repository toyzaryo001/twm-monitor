'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TenantSummary {
    id: string;
    name: string;
    prefix: string;
    isActive: boolean;
    userCount: number;
    accountCount: number;
}

interface Stats {
    tenantCount: number;
    activeTenants: number;
    userCount: number;
}

export default function MasterDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [tenants, setTenants] = useState<TenantSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const token = localStorage.getItem('twm_token');
        if (!token) return;

        try {
            const [overviewRes, tenantsRes] = await Promise.all([
                fetch('/api/master/overview', {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch('/api/master/tenants', {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (overviewRes.ok) {
                const overviewData = await overviewRes.json();
                setStats(overviewData.data);
            }

            if (tenantsRes.ok) {
                const tenantsData = await tenantsRes.json();
                setTenants(tenantsData.data.slice(0, 5)); // Show top 5
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
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
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-slate-400">Welcome to TWM Monitor Master Panel</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard
                    label="Total Prefixes"
                    value={stats?.tenantCount ?? 0}
                    icon="building"
                    color="indigo"
                />
                <StatCard
                    label="Active Prefixes"
                    value={stats?.activeTenants ?? 0}
                    icon="check"
                    color="green"
                />
                <StatCard
                    label="Total Users"
                    value={stats?.userCount ?? 0}
                    icon="users"
                    color="purple"
                />
            </div>

            {/* Recent Tenants */}
            <div className="card">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-white">Recent Prefixes</h2>
                    <Link href="/master/tenants" className="text-sm text-indigo-400 hover:text-indigo-300">
                        View All →
                    </Link>
                </div>

                {tenants.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-slate-400 mb-4">No prefixes created yet</p>
                        <Link href="/master/tenants" className="btn btn-primary">
                            Create First Prefix
                        </Link>
                    </div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Prefix</th>
                                <th>Status</th>
                                <th>Users</th>
                                <th>Accounts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map((tenant) => (
                                <tr key={tenant.id}>
                                    <td className="font-medium text-white">{tenant.name}</td>
                                    <td>
                                        <code className="text-xs bg-slate-700 px-2 py-1 rounded">
                                            {tenant.prefix}
                                        </code>
                                    </td>
                                    <td>
                                        <span className={`badge ${tenant.isActive ? 'badge-success' : 'badge-danger'}`}>
                                            {tenant.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>{tenant.userCount}</td>
                                    <td>{tenant.accountCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <Link href="/master/tenants" className="card card-hover group">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Create New Prefix</h3>
                            <p className="text-sm text-slate-400">Add a new tenant prefix to the system</p>
                        </div>
                    </div>
                </Link>

                <Link href="/master/users" className="card card-hover group">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                            <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Add User</h3>
                            <p className="text-sm text-slate-400">Create a new user account</p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
    const colors: Record<string, string> = {
        indigo: 'from-indigo-500/20 to-indigo-600/10 text-indigo-400',
        green: 'from-green-500/20 to-green-600/10 text-green-400',
        purple: 'from-purple-500/20 to-purple-600/10 text-purple-400',
    };

    return (
        <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
                    <StatIcon name={icon} />
                </div>
            </div>
            <p className="stat-value">{value}</p>
            <p className="stat-label">{label}</p>
        </div>
    );
}

function StatIcon({ name }: { name: string }) {
    switch (name) {
        case 'building':
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            );
        case 'check':
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        case 'users':
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            );
        default:
            return null;
    }
}
