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
            <div style={{
                minHeight: "100vh",
                background: "#020617",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
            }}>
                <div className="spinner" style={{ width: 50, height: 50, borderWidth: 4 }} />
            </div>
        );
    }

    return (
        <div style={{
            minHeight: "100vh",
            background: "radial-gradient(circle at top right, #1e293b, #020617)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
            overflow: "hidden",
            position: "relative"
        }}>
            {/* Background Effects */}
            <div style={{
                position: "absolute",
                top: "-20%",
                right: "-10%",
                width: "600px",
                height: "600px",
                background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, rgba(0,0,0,0) 70%)",
                borderRadius: "50%",
                filter: "blur(60px)",
                animation: "float 10s infinite ease-in-out"
            }} />
            <div style={{
                position: "absolute",
                bottom: "-10%",
                left: "-10%",
                width: "500px",
                height: "500px",
                background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0) 70%)",
                borderRadius: "50%",
                filter: "blur(60px)",
                animation: "float 15s infinite ease-in-out reverse"
            }} />

            <style jsx>{`
                @keyframes float {
                    0% { transform: translate(0, 0); }
                    50% { transform: translate(20px, -20px); }
                    100% { transform: translate(0, 0); }
                }
                @keyframes slideUp {
                    from { transform: translateY(40px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .glass-card {
                    background: rgba(30, 41, 59, 0.4);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    border-radius: 24px;
                    padding: 40px;
                    width: 100%;
                    max-width: 420px;
                    animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                    overflow: hidden;
                }
                .glass-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                }
                .input-modern {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    padding: 14px 16px;
                    border-radius: 12px;
                    width: 100%;
                    font-size: 1rem;
                    transition: all 0.2s;
                    backdrop-filter: blur(4px);
                }
                .input-modern:focus {
                    background: rgba(15, 23, 42, 0.8);
                    border-color: #06b6d4;
                    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
                    outline: none;
                    transform: translateY(-1px);
                }
                .btn-modern {
                    background: linear-gradient(135deg, #06b6d4, #3b82f6);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    padding: 14px;
                    font-weight: 600;
                    font-size: 1rem;
                    width: 100%;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                    overflow: hidden;
                }
                .btn-modern:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px -5px rgba(6, 182, 212, 0.4);
                    filter: brightness(1.1);
                }
                .btn-modern:active {
                    transform: translateY(0);
                }
                .brand-glow {
                    font-size: 2.5rem;
                    font-weight: 800;
                    background: linear-gradient(135deg, #22d3ee, #3b82f6);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    text-shadow: 0 0 30px rgba(6, 182, 212, 0.3);
                    margin-bottom: 8px;
                    text-align: center;
                }
            `}</style>

            <div className="glass-card">
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{ fontSize: 48, marginBottom: 16, animation: "float 6s infinite ease-in-out" }}>💎</div>
                    <h1 className="brand-glow">
                        {networkName || "Panel Access"}
                    </h1>
                    <p style={{ color: "#94a3b8", fontSize: "0.95rem" }}>
                        เข้าสู่ระบบเพื่อจัดการวอลเล็ท
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>
                    {error && (
                        <div style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            color: "#f87171",
                            padding: "12px",
                            borderRadius: "10px",
                            fontSize: "0.9rem",
                            textAlign: "center",
                            animation: "fadeIn 0.3s"
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <div>
                        <input
                            type="text"
                            className="input-modern"
                            value={form.prefix}
                            onChange={(e) => setForm({ ...form, prefix: e.target.value.toLowerCase() })}
                            placeholder="Prefix เครือข่าย"
                            required
                            autoComplete="off"
                            style={{ fontFamily: "'Prompt', monospace", letterSpacing: "0.05em" }}
                        />
                        {networkName && (
                            <div style={{
                                fontSize: 12,
                                color: "#34d399",
                                marginTop: 8,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                paddingLeft: 4,
                                animation: "fadeIn 0.3s"
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                                พบเครือข่าย: {networkName}
                            </div>
                        )}
                    </div>

                    <div>
                        <input
                            type="text"
                            className="input-modern"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            placeholder="ชื่อผู้ใช้"
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div>
                        <input
                            type="password"
                            className="input-modern"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="รหัสผ่าน"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-modern"
                        disabled={submitting || !networkName}
                        style={{ marginTop: 12 }}
                    >
                        {submitting ? (
                            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                <span className="spinner" style={{ width: 16, height: 16, borderTopColor: "white", borderWidth: 2 }} />
                                กำลังตรวจสอบ...
                            </span>
                        ) : (
                            "เข้าสู่ระบบ →"
                        )}
                    </button>

                    <div style={{ textAlign: "center", marginTop: 12 }}>
                        <a href="/master/login" style={{ color: "#64748b", fontSize: "0.85rem", textDecoration: "none", transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "#94a3b8"} onMouseOut={e => e.currentTarget.style.color = "#64748b"}>
                            สำหรับผู้ดูและระบบ (Master)
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}
