"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [isSetup, setIsSetup] = useState(false);
    const [needsSetup, setNeedsSetup] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");

    useEffect(() => {
        fetch("/api/master/auth/setup-status")
            .then((r) => r.json())
            .then((data) => {
                setNeedsSetup(data.needsSetup);
                setIsSetup(data.needsSetup);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const endpoint = isSetup ? "/api/master/auth/setup" : "/api/master/auth/login";
            const body = isSetup
                ? { email, password, displayName }
                : { email, password };

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!data.ok) {
                setError(data.error === "INVALID_CREDENTIALS" ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : data.error);
                setLoading(false);
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            router.push("/master/dashboard");
        } catch {
            setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
            setLoading(false);
        }
    };

    if (loading && needsSetup === false) {
        return (
            <div className="login-container">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="card login-card">
                <h1 className="login-title">🔐 Master Panel</h1>
                <p className="login-subtitle">
                    {isSetup ? "สร้างบัญชีผู้ดูแลระบบ" : "เข้าสู่ระบบ"}
                </p>

                <form onSubmit={handleSubmit}>
                    {isSetup && (
                        <div className="form-group">
                            <label className="form-label">ชื่อแสดง</label>
                            <input
                                type="text"
                                className="form-input"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Master Admin"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">อีเมล</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="admin@example.com"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">รหัสผ่าน</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <div style={{ color: "var(--error)", marginBottom: 16, fontSize: 14 }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
                        {loading ? "กำลังดำเนินการ..." : isSetup ? "สร้างบัญชี" : "เข้าสู่ระบบ"}
                    </button>
                </form>

                {needsSetup && !isSetup && (
                    <button
                        onClick={() => setIsSetup(true)}
                        className="btn btn-secondary"
                        style={{ width: "100%", marginTop: 12 }}
                    >
                        สร้างบัญชีผู้ดูแลระบบ
                    </button>
                )}
            </div>
        </div>
    );
}
