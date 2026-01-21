'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MasterLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSetup, setIsSetup] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const endpoint = isSetup ? '/api/master/auth/setup' : '/api/master/auth/login';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error === 'SETUP_ALREADY_COMPLETE') {
                    setIsSetup(false);
                    setError('Setup already complete. Please login.');
                } else if (data.error === 'INVALID_CREDENTIALS') {
                    setError('Invalid email or password.');
                } else {
                    setError(data.error || 'An error occurred.');
                }
                return;
            }

            if (isSetup) {
                setIsSetup(false);
                setError('');
                alert('Admin account created! Please login.');
            } else {
                // Store token and redirect
                localStorage.setItem('twm_token', data.data.accessToken);
                localStorage.setItem('twm_user', JSON.stringify(data.data.user));
                router.push('/master/dashboard');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white">TWM Monitor</h1>
                    <p className="text-slate-400 mt-2">Master Administration</p>
                </div>

                {/* Login Card */}
                <div className="card">
                    <h2 className="text-xl font-semibold text-white mb-6">
                        {isSetup ? 'Create Admin Account' : 'Sign In'}
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
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@example.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={isSetup ? 8 : 1}
                            />
                            {isSetup && (
                                <p className="text-xs text-slate-500 mt-1">Minimum 8 characters</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full mt-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="spinner" />
                            ) : isSetup ? (
                                'Create Account'
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-700 text-center">
                        <button
                            type="button"
                            className="text-sm text-slate-400 hover:text-white transition-colors"
                            onClick={() => setIsSetup(!isSetup)}
                        >
                            {isSetup ? 'Already have an account? Sign in' : 'First time? Create admin account'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-slate-500 text-sm mt-6">
                    TrueWallet Monitoring System
                </p>
            </div>
        </div>
    );
}
