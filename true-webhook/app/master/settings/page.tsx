'use client';

import { useState, useEffect } from 'react';

interface SettingsData {
    jwtSecret: string;
    jwtSecretLength: number;
    databaseConfigured: boolean;
    nodeEnv: string;
    port: string;
}

interface SystemData {
    version: string;
    nodeVersion: string;
    platform: string;
    uptime: number;
    memory: { used: number; total: number };
}

interface ValidationData {
    valid: boolean;
    issues: string[];
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [system, setSystem] = useState<SystemData | null>(null);
    const [validation, setValidation] = useState<ValidationData | null>(null);
    const [generatedSecret, setGeneratedSecret] = useState('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const token = localStorage.getItem('twm_token');
        try {
            const [settingsRes, systemRes, validateRes] = await Promise.all([
                fetch('/api/master/settings', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/master/settings/system', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/master/settings/validate-jwt-secret', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (settingsRes.ok) {
                const data = await settingsRes.json();
                setSettings(data.data);
            }
            if (systemRes.ok) {
                const data = await systemRes.json();
                setSystem(data.data);
            }
            if (validateRes.ok) {
                const data = await validateRes.json();
                setValidation(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        } finally {
            setLoading(false);
        }
    }

    async function generateSecret() {
        const token = localStorage.getItem('twm_token');
        try {
            const res = await fetch('/api/master/settings/generate-jwt-secret', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setGeneratedSecret(data.data.secret);
            }
        } catch (err) {
            console.error('Failed to generate secret:', err);
        }
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (days > 0) return `${days}d ${hours}h ${mins}m`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
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
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-slate-400">System configuration and security settings</p>
            </div>

            {/* JWT Security Alert */}
            {validation && !validation.valid && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-red-400">Security Warning</h3>
                            <ul className="text-sm text-red-300 mt-1">
                                {validation.issues.map((issue, i) => (
                                    <li key={i}>• {issue}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* JWT Secret Settings */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        JWT Secret
                    </h2>

                    <div className="space-y-4">
                        <div className="bg-slate-800 rounded-lg p-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wider">Current Secret</label>
                            <p className="font-mono text-white mt-1">{settings?.jwtSecret || 'NOT SET'}</p>
                            <p className="text-xs text-slate-500 mt-1">Length: {settings?.jwtSecretLength || 0} characters</p>
                        </div>

                        <div className="bg-slate-800 rounded-lg p-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wider">Status</label>
                            <div className="flex items-center gap-2 mt-1">
                                {validation?.valid ? (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                        <span className="text-green-400">Secure</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                        <span className="text-red-400">Needs Attention</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <button onClick={generateSecret} className="btn btn-primary w-full">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Generate New Secret
                        </button>

                        {generatedSecret && (
                            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                                <label className="text-xs text-indigo-400 uppercase tracking-wider">New Generated Secret</label>
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        className="input font-mono text-xs"
                                        value={generatedSecret}
                                        readOnly
                                    />
                                    <button
                                        onClick={() => copyToClipboard(generatedSecret)}
                                        className="btn btn-secondary flex-shrink-0"
                                    >
                                        {copied ? '✓' : 'Copy'}
                                    </button>
                                </div>
                                <div className="mt-3 text-sm text-slate-400">
                                    <p className="font-semibold text-white mb-1">To apply this secret:</p>
                                    <ol className="list-decimal list-inside space-y-1 text-xs">
                                        <li>Copy the secret above</li>
                                        <li>Go to Railway → Variables</li>
                                        <li>Set <code className="bg-slate-700 px-1 rounded">JWT_SECRET</code> = copied value</li>
                                        <li>Redeploy the service</li>
                                    </ol>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* System Info */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                        System Info
                    </h2>

                    <div className="space-y-3">
                        <InfoRow label="Version" value={system?.version || '-'} />
                        <InfoRow label="Node.js" value={system?.nodeVersion || '-'} />
                        <InfoRow label="Platform" value={system?.platform || '-'} />
                        <InfoRow label="Environment" value={settings?.nodeEnv || '-'} />
                        <InfoRow label="Port" value={settings?.port || '-'} />
                        <InfoRow label="Uptime" value={system ? formatUptime(system.uptime) : '-'} />
                        <InfoRow
                            label="Memory"
                            value={system ? `${system.memory.used} MB / ${system.memory.total} MB` : '-'}
                        />
                        <InfoRow
                            label="Database"
                            value={settings?.databaseConfigured ? 'Connected' : 'Not Connected'}
                            status={settings?.databaseConfigured ? 'success' : 'error'}
                        />
                    </div>
                </div>

                {/* Quick Reference */}
                <div className="card lg:col-span-2">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Quick Reference - Railway Variables
                    </h2>

                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Variable</th>
                                    <th>Description</th>
                                    <th>Required</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><code className="text-indigo-400">JWT_SECRET</code></td>
                                    <td>Secret key for JWT signing (64 chars recommended)</td>
                                    <td><span className="badge badge-danger">Required</span></td>
                                </tr>
                                <tr>
                                    <td><code className="text-indigo-400">DATABASE_URL</code></td>
                                    <td>PostgreSQL connection string (auto-set by Railway)</td>
                                    <td><span className="badge badge-danger">Required</span></td>
                                </tr>
                                <tr>
                                    <td><code className="text-indigo-400">RESET_DB</code></td>
                                    <td>Set to "true" to reset database (remove after use!)</td>
                                    <td><span className="badge bg-slate-600/50 text-slate-300">Optional</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value, status }: { label: string; value: string; status?: 'success' | 'error' }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
            <span className="text-slate-400">{label}</span>
            <span className={`font-medium ${status === 'success' ? 'text-green-400' :
                    status === 'error' ? 'text-red-400' :
                        'text-white'
                }`}>
                {value}
            </span>
        </div>
    );
}
