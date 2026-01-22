"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function TenantLoginPage() {
    const router = useRouter();
    const params = useParams();
    const prefix = params.prefix as string;

    const [networkName, setNetworkName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ username: "", password: "" });

    useEffect(() => {
        // Check network status
        const checkNetwork = async () => {
            try {
                const res = await fetch(`/api/tenant/${prefix}/auth/status`);
                const data = await res.json();

                if (!data.ok) {
                    setError("ไม่พบเครือข่ายนี้");
                } else if (!data.data.isActive) {
                    setError("เครือข่ายนี้ถูกปิดใช้งาน");
                } else {
                    setNetworkName(data.data.name);
                }
            } catch (e) {
                setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
            }
            setLoading(false);
        };

        // Check if already logged in
        const token = localStorage.getItem("tenantToken");
        if (token) {
            router.push(`/tenant/${prefix}/dashboard`);
            return;
        }

        checkNetwork();
    }, [prefix, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            const res = await fetch(`/api/tenant/${prefix}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!data.ok) {
                if (data.error === "INVALID_CREDENTIALS") {
                    setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
                } else if (data.error === "NETWORK_INACTIVE") {
                    setError("เครือข่ายนี้ถูกปิดใช้งาน");
                } else {
                    setError(data.error || "เกิดข้อผิดพลาด");
                }
                setSubmitting(false);
                return;
            }

            // Save token and user info
            localStorage.setItem("tenantToken", data.data.token);
            localStorage.setItem("tenantUser", JSON.stringify(data.data.user));

            // Redirect to dashboard
            router.push(`/tenant/${prefix}/dashboard`);
        } catch (e) {
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="loading" style={{ minHeight: "100vh", alignItems: "center" }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1 className="auth-title">🌐 {networkName || prefix}</h1>
                    <p className="auth-subtitle">เข้าสู่ระบบเครือข่าย</p>
                </div>

                {error && !networkName ? (
                    <div className="alert alert-error" style={{ marginBottom: 16 }}>
                        {error}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {error && (
                            <div className="alert alert-error" style={{ marginBottom: 16 }}>
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">ชื่อผู้ใช้</label>
                            <input
                                type="text"
                                className="form-input"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                placeholder="username"
                                required
                                autoComplete="username"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">รหัสผ่าน</label>
                            <input
                                type="password"
                                className="form-input"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: "100%", marginTop: 8 }}
                            disabled={submitting}
                        >
                            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                        </button>
                    </form>
                )}

                <div style={{ marginTop: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    <a href="/master/login" style={{ color: "var(--accent)" }}>
                        เข้าสู่ระบบ Master Panel
                    </a>
                </div>
            </div>
        </div>
    );
}
