"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function TenantLoginPage() {
    const router = useRouter();
    const params = useParams();
    const prefixFromUrl = params.prefix as string;

    const [networkName, setNetworkName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        prefix: "",  // Always start empty, user must fill in
        username: "",
        password: ""
    });

    // Check network when prefix changes
    const checkNetwork = async (prefix: string) => {
        if (!prefix) {
            setNetworkName("");
            return;
        }

        try {
            const res = await fetch(`/api/tenant/${prefix}/auth/status`);
            const data = await res.json();

            if (!data.ok) {
                setNetworkName("");
                setError("เครือข่ายนี้ไม่มีในระบบ");
            } else if (!data.data.isActive) {
                setNetworkName("");
                setError("เครือข่ายนี้ถูกปิดใช้งาน");
            } else {
                setNetworkName(data.data.name);
                setError("");
            }
        } catch (e) {
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        }
    };

    useEffect(() => {
        // Check if already logged in
        const token = localStorage.getItem("tenantToken");
        const savedPrefix = localStorage.getItem("tenantPrefix");
        if (token && savedPrefix) {
            router.push("/dashboard");
            return;
        }

        // Don't auto-check from URL, user must fill in prefix manually
        setLoading(false);
    }, [router]);

    // Debounce prefix check - always check when user types
    useEffect(() => {
        if (form.prefix) {
            const timer = setTimeout(() => {
                checkNetwork(form.prefix);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setNetworkName("");
            setError("");
        }
    }, [form.prefix]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!form.prefix) {
            setError("กรุณากรอก Prefix ของเครือข่าย");
            return;
        }

        setSubmitting(true);

        try {
            const res = await fetch(`/api/tenant/${form.prefix}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: form.username,
                    password: form.password
                }),
            });

            const data = await res.json();

            if (!data.ok) {
                if (data.error === "INVALID_CREDENTIALS") {
                    setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
                } else if (data.error === "NETWORK_INACTIVE") {
                    setError("เครือข่ายนี้ถูกปิดใช้งาน");
                } else if (data.error === "NETWORK_NOT_FOUND") {
                    setError("ไม่พบเครือข่ายนี้");
                } else {
                    setError(data.error || "เกิดข้อผิดพลาด");
                }
                setSubmitting(false);
                return;
            }

            // Save login data
            localStorage.setItem("tenantToken", data.data.token);
            localStorage.setItem("tenantUser", JSON.stringify(data.data.user));
            localStorage.setItem("tenantPrefix", form.prefix);

            // Redirect to dashboard using short URL
            router.push("/dashboard");
        } catch (e) {
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="tenant-login-container">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="tenant-login-container">
            <div className="tenant-login-card">
                <div className="tenant-login-header">
                    <div className="tenant-login-icon">💰</div>
                    <h1 className="tenant-login-title">
                        {networkName || "Tenant Panel"}
                    </h1>
                    <p className="tenant-login-subtitle">เข้าสู่ระบบเพื่อใช้งาน</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="tenant-alert tenant-alert-error">
                            {error}
                        </div>
                    )}

                    <div className="tenant-form-group">
                        <label className="tenant-form-label">Prefix เครือข่าย</label>
                        <input
                            type="text"
                            className="tenant-form-input"
                            value={form.prefix}
                            onChange={(e) => setForm({ ...form, prefix: e.target.value.toLowerCase() })}
                            placeholder=""
                            required
                            autoComplete="off"
                            style={{ fontFamily: "monospace" }}
                        />
                        {networkName && (
                            <div style={{ fontSize: 12, color: "var(--success)", marginTop: 6 }}>
                                ✓ {networkName}
                            </div>
                        )}
                    </div>

                    <div className="tenant-form-group">
                        <label className="tenant-form-label">ชื่อผู้ใช้</label>
                        <input
                            type="text"
                            className="tenant-form-input"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            placeholder="กรอกชื่อผู้ใช้"
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div className="tenant-form-group">
                        <label className="tenant-form-label">รหัสผ่าน</label>
                        <input
                            type="password"
                            className="tenant-form-input"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="tenant-btn tenant-btn-primary"
                        style={{ width: "100%", marginTop: 8, padding: "14px 20px" }}
                        disabled={submitting || !networkName}
                    >
                        {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                    </button>
                </form>

                <div style={{ marginTop: 32, textAlign: "center", paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                    <a
                        href="/master/login"
                        style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}
                    >
                        เข้าสู่ระบบ Master Panel →
                    </a>
                </div>
            </div>
        </div>
    );
}
