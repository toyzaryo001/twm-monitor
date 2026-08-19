"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [isSetup, setIsSetup] = useState(false);
    const [needsSetup, setNeedsSetup] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [requiresSetupSecret, setRequiresSetupSecret] = useState(false);
    const [setupSecret, setSetupSecret] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    useEffect(() => {
        fetch("/api/master/auth/setup-status")
            .then((response) => response.json())
            .then((data) => {
                setNeedsSetup(data.needsSetup);
                setIsSetup(data.needsSetup);
                setRequiresSetupSecret(Boolean(data.requiresSetupSecret));
                setLoading(false);
            })
            .catch(() => {
                setError("เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง");
                setLoading(false);
            });
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            const endpoint = isSetup ? "/api/master/auth/setup" : "/api/master/auth/login";
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: username.trim(),
                    password,
                    ...(isSetup && requiresSetupSecret ? { setupSecret } : {}),
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setError(data.error === "INVALID_CREDENTIALS" ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง ตรวจตัวพิมพ์และลองอีกครั้ง" : data.error);
                setSubmitting(false);
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            router.push("/master/dashboard");
        } catch {
            setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
            setSubmitting(false);
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
            <div className="login-shell">
                <section className="login-hero">
                    <div>
                        <div className="master-brand-mark" style={{ marginBottom: 22 }}>TM</div>
                        <div className="master-eyebrow">Private Operations Console</div>
                        <h1 className="login-title">ควบคุมระบบแบบมั่นใจ</h1>
                        <p className="login-subtitle">
                            Master Panel สำหรับดูแลเครือข่าย แพ็คเกจ การชำระเงิน และการตั้งค่าหลังบ้านทั้งหมด
                        </p>
                    </div>
                    <div className="login-proof-grid">
                        <div className="login-proof">
                            <div className="stat-label">Access</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent-gold)" }}>MASTER</div>
                        </div>
                        <div className="login-proof">
                            <div className="stat-label">Session</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent)" }}>12H</div>
                        </div>
                        <div className="login-proof">
                            <div className="stat-label">Scope</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--success)" }}>ALL</div>
                        </div>
                    </div>
                </section>

                <section className="login-card">
                    <div className="master-eyebrow">{isSetup ? "Initial Setup" : "Secure Login"}</div>
                    <h2 className="login-title">{isSetup ? "สร้างบัญชี Master" : "เข้าสู่ระบบ"}</h2>
                    <p className="login-subtitle">
                        {isSetup ? "ตั้งค่าผู้ดูแลระบบคนแรกเพื่อเริ่มใช้งาน" : "ใช้บัญชี Master เพื่อจัดการทุกเครือข่าย"}
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">ชื่อผู้ใช้</label>
                            <input
                                type="text"
                                className="form-input"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                required
                                placeholder="เช่น superTT"
                                autoComplete="username"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">รหัสผ่าน</label>
                            <div className="password-field">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="form-input"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                    minLength={6}
                                    placeholder="กรอกรหัสผ่าน"
                                    autoComplete={isSetup ? "new-password" : "current-password"}
                                />
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPassword((value) => !value)}>
                                    {showPassword ? "ซ่อน" : "แสดง"}
                                </button>
                            </div>
                        </div>

                        {isSetup && requiresSetupSecret && (
                            <div className="form-group">
                                <label className="form-label">Setup Secret</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={setupSecret}
                                    onChange={(event) => setSetupSecret(event.target.value)}
                                    required
                                    placeholder="MASTER_SETUP_SECRET"
                                    autoComplete="off"
                                />
                            </div>
                        )}

                        {error && <div className="login-error">{error}</div>}

                        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={submitting}>
                            {submitting ? "กำลังตรวจสอบ..." : isSetup ? "สร้างบัญชี Master" : "เข้าสู่ระบบ"}
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}
