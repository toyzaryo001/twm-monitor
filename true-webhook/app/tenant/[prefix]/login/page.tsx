"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function TenantLoginPage() {
    const router = useRouter();
    const params = useParams();
    const prefixFromUrl = params.prefix as string;

    const [networkName, setNetworkName] = useState<string>("");
    const [networkLogo, setNetworkLogo] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        prefix: prefixFromUrl || "",
        username: "",
        password: ""
    });

    // Check network when prefix changes
    const checkNetwork = async (prefix: string) => {
        if (!prefix) {
            setNetworkName("");
            setNetworkLogo(null);
            return;
        }

        try {
            const res = await fetch(`/api/tenant/${prefix}/auth/status`);
            const data = await res.json();

            if (!data.ok) {
                setNetworkName("");
                setNetworkLogo(null);
                setError("เครือข่ายนี้ไม่มีในระบบ");
            } else if (!data.data.isActive) {
                setNetworkName("");
                setNetworkLogo(null);
                setError("เครือข่ายนี้ถูกปิดใช้งาน");
            } else {
                setNetworkName(data.data.name);
                setNetworkLogo(data.data.logoUrl || null);
                setError("");
            }
        } catch {
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        }
    };

    useEffect(() => {
        // Check if already logged in
        const token = localStorage.getItem("tenantToken");
        const savedPrefix = localStorage.getItem("tenantPrefix");
        if (token && savedPrefix) {
            router.push(`/tenant/${savedPrefix}/dashboard`);
            return;
        }

        setLoading(false);
    }, [router]);

    // Debounce prefix check
    useEffect(() => {
        if (form.prefix) {
            const timer = setTimeout(() => {
                checkNetwork(form.prefix);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setNetworkName("");
            setNetworkLogo(null);
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
                    setError(data.error || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
                }
                setSubmitting(false);
                return;
            }

            // Save login data
            localStorage.setItem("tenantToken", data.data.token);
            localStorage.setItem("tenantUser", JSON.stringify(data.data.user));
            localStorage.setItem("tenantPrefix", form.prefix);

            router.push(`/tenant/${form.prefix}/dashboard`);
        } catch {
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                minHeight: "100vh",
                background: "#09090b",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
            }}>
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, borderTopColor: "#10b981" }} />
            </div>
        );
    }

    return (
        <div style={{
            minHeight: "100vh",
            background: "#09090b",
            backgroundImage: "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(16, 185, 129, 0.12), transparent 70%), radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 24px 24px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
            position: "relative"
        }}>
            <div
                style={{
                    background: "#141417",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 18,
                    padding: "36px 32px",
                    width: "100%",
                    maxWidth: 420,
                    boxShadow: "0 20px 45px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04)",
                    position: "relative",
                    overflow: "hidden"
                }}
            >
                {/* Top Subtle Emerald Accent Line */}
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: "linear-gradient(90deg, transparent, #10b981, transparent)"
                }} />

                {/* Brand / Logo Header */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    {networkLogo ? (
                        <div style={{ marginBottom: 14 }}>
                            <img
                                src={networkLogo}
                                alt={networkName || "Logo"}
                                style={{ maxHeight: 52, maxWidth: 180, margin: "0 auto", display: "block", objectFit: "contain" }}
                            />
                        </div>
                    ) : (
                        <div style={{
                            width: 52,
                            height: 52,
                            borderRadius: 14,
                            background: "rgba(16, 185, 129, 0.12)",
                            border: "1px solid rgba(16, 185, 129, 0.25)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 14px auto",
                            color: "#10b981",
                            boxShadow: "0 8px 24px rgba(16, 185, 129, 0.15)"
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="5" width="20" height="14" rx="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                        </div>
                    )}

                    <h1 style={{
                        fontSize: "1.45rem",
                        fontWeight: 700,
                        color: "#fafafa",
                        letterSpacing: "-0.02em",
                        margin: 0,
                        lineHeight: 1.2
                    }}>
                        {networkName || (prefixFromUrl ? prefixFromUrl.toUpperCase() : "เข้าสู่ระบบ")}
                    </h1>
                    <p style={{ color: "#71717a", fontSize: "0.85rem", marginTop: 6, marginBottom: 0 }}>
                        เข้าสู่ระบบเพื่อจัดการวอลเล็ทและตรวจสอบรายการ
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
                    {error && (
                        <div style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.25)",
                            color: "#f87171",
                            padding: "10px 14px",
                            borderRadius: 10,
                            fontSize: "0.85rem",
                            display: "flex",
                            alignItems: "center",
                            gap: 8
                        }}>
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Prefix field */}
                    <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#a1a1aa", marginBottom: 6 }}>
                            Prefix เครือข่าย
                        </label>
                        <input
                            type="text"
                            value={form.prefix}
                            onChange={(e) => setForm({ ...form, prefix: e.target.value.toLowerCase() })}
                            placeholder="เช่น jga88"
                            required
                            autoComplete="off"
                            style={{
                                width: "100%",
                                height: 42,
                                padding: "0 14px",
                                background: "#18181b",
                                border: "1px solid #27272a",
                                borderRadius: 10,
                                color: "#fafafa",
                                fontSize: "0.92rem",
                                fontFamily: "monospace",
                                outline: "none",
                                transition: "border-color 0.2s, box-shadow 0.2s"
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = "#10b981";
                                e.target.style.boxShadow = "0 0 0 2px rgba(16, 185, 129, 0.2)";
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = "#27272a";
                                e.target.style.boxShadow = "none";
                            }}
                        />
                        {networkName && (
                            <div style={{
                                fontSize: "0.78rem",
                                color: "#34d399",
                                marginTop: 6,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                paddingLeft: 2
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                                พบเครือข่าย: <strong>{networkName}</strong>
                            </div>
                        )}
                    </div>

                    {/* Username field */}
                    <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#a1a1aa", marginBottom: 6 }}>
                            ชื่อผู้ใช้
                        </label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            placeholder="ระบุชื่อผู้ใช้"
                            required
                            autoComplete="username"
                            style={{
                                width: "100%",
                                height: 42,
                                padding: "0 14px",
                                background: "#18181b",
                                border: "1px solid #27272a",
                                borderRadius: 10,
                                color: "#fafafa",
                                fontSize: "0.92rem",
                                outline: "none",
                                transition: "border-color 0.2s, box-shadow 0.2s"
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = "#10b981";
                                e.target.style.boxShadow = "0 0 0 2px rgba(16, 185, 129, 0.2)";
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = "#27272a";
                                e.target.style.boxShadow = "none";
                            }}
                        />
                    </div>

                    {/* Password field */}
                    <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#a1a1aa", marginBottom: 6 }}>
                            รหัสผ่าน
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder="ระบุรหัสผ่าน"
                                required
                                autoComplete="current-password"
                                style={{
                                    width: "100%",
                                    height: 42,
                                    padding: "0 40px 0 14px",
                                    background: "#18181b",
                                    border: "1px solid #27272a",
                                    borderRadius: 10,
                                    color: "#fafafa",
                                    fontSize: "0.92rem",
                                    outline: "none",
                                    transition: "border-color 0.2s, box-shadow 0.2s"
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = "#10b981";
                                    e.target.style.boxShadow = "0 0 0 2px rgba(16, 185, 129, 0.2)";
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = "#27272a";
                                    e.target.style.boxShadow = "none";
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: "absolute",
                                    right: 10,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "transparent",
                                    border: "none",
                                    color: "#71717a",
                                    cursor: "pointer",
                                    padding: 4,
                                    fontSize: "0.9rem"
                                }}
                                title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                            >
                                {showPassword ? "🙈" : "👁️"}
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting || !networkName}
                        style={{
                            marginTop: 8,
                            height: 44,
                            background: !networkName ? "#27272a" : "#10b981",
                            color: !networkName ? "#71717a" : "#09090b",
                            border: "none",
                            borderRadius: 10,
                            fontWeight: 600,
                            fontSize: "0.95rem",
                            cursor: !networkName ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            transition: "all 0.2s ease",
                            boxShadow: networkName ? "0 4px 16px rgba(16, 185, 129, 0.25)" : "none"
                        }}
                    >
                        {submitting ? (
                            <>
                                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: "#09090b" }} />
                                กำลังเข้าสู่ระบบ...
                            </>
                        ) : (
                            <>เข้าสู่ระบบ →</>
                        )}
                    </button>

                    {/* Master Login Link */}
                    <div style={{ textAlign: "center", marginTop: 10 }}>
                        <a
                            href="/master/login"
                            style={{
                                color: "#71717a",
                                fontSize: "0.82rem",
                                textDecoration: "none",
                                transition: "color 0.2s ease"
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.color = "#a1a1aa")}
                            onMouseOut={(e) => (e.currentTarget.style.color = "#71717a")}
                        >
                            สำหรับผู้ดูแลระบบส่วนกลาง (Master)
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}
