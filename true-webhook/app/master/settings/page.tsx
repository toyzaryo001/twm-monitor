"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
    const [jwtSecret, setJwtSecret] = useState("");
    const [savedSecret, setSavedSecret] = useState("");
    const [currentEnvSecret, setCurrentEnvSecret] = useState("");
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);

    const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : "";

    const fetchSettings = async () => {
        const token = getToken();
        if (!token) return;

        try {
            const res = await fetch("/api/master/settings", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) {
                if (data.data.JWT_SECRET) setSavedSecret(data.data.JWT_SECRET);
                if (data.data.currentJwtSecret) setCurrentEnvSecret(data.data.currentJwtSecret);
            }
        } catch (e) {
            console.error("Error fetching settings", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const generateSecret = () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const secret = Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
        setJwtSecret(secret);
        setCopied(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const saveSecret = async () => {
        if (!jwtSecret) return;
        const token = getToken();

        try {
            const res = await fetch("/api/master/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ key: "JWT_SECRET", value: jwtSecret })
            });
            const data = await res.json();
            if (data.ok) {
                alert("บันทึกเรียบร้อย");
                setSavedSecret(jwtSecret);
            } else {
                alert("เกิดข้อผิดพลาด");
            }
        } catch (e) {
            alert("เกิดข้อผิดพลาด");
        }
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">ตั้งค่าระบบ</h1>
            </div>

            {/* Current Active Secret */}
            <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--accent)" }}>
                <div className="card-title">สถานะความปลอดภัย (Current Runtime)</div>
                <div className="form-group">
                    <label className="form-label">Active JWT Secret (ค่าที่กำลังใช้งานจริง)</label>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            type="text"
                            className="form-input"
                            value={currentEnvSecret}
                            readOnly
                            style={{ fontFamily: "monospace", color: currentEnvSecret === savedSecret ? "var(--success)" : "var(--warning)" }}
                        />
                        <button className="btn btn-secondary" onClick={() => copyToClipboard(currentEnvSecret)}>
                            คัดลอก
                        </button>
                    </div>
                    {currentEnvSecret !== savedSecret && savedSecret && (
                        <p style={{ color: "var(--warning)", fontSize: 13, marginTop: 8 }}>
                            ⚠️ ค่าที่บันทึกไว้ในฐานข้อมูลไม่ตรงกับค่าที่ใช้งานอยู่ (ต้อง Redeploy เพื่อให้ค่าใหม่ทำงาน)
                        </p>
                    )}
                </div>
            </div>

            {/* Generator & Storage */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-title">JWT Secret Generator (Database Storage)</div>
                <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
                    สร้างและบันทึก JWT Secret ลงฐานข้อมูล (เพื่อนำไปใส่ใน Railway Variables)
                </p>

                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <button className="btn btn-primary" onClick={generateSecret}>
                        🔑 สร้าง Secret ใหม่
                    </button>
                    {jwtSecret && (
                        <button className="btn btn-success" style={{ background: 'var(--success)' }} onClick={saveSecret}>
                            💾 บันทึกลงฐานข้อมูล
                        </button>
                    )}
                </div>

                {jwtSecret && (
                    <div style={{ marginBottom: 24 }}>
                        <label className="form-label">Secret ที่สร้างใหม่ (ยังไม่ได้ใช้งานจนกว่าจะบันทึกและ Redeploy)</label>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input type="text" className="form-input" value={jwtSecret} readOnly style={{ fontFamily: "monospace" }} />
                            <button className="btn btn-secondary" onClick={() => copyToClipboard(jwtSecret)}>
                                {copied ? "✓ คัดลอกแล้ว" : "คัดลอก"}
                            </button>
                        </div>
                    </div>
                )}

                <div className="form-group" style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    <label className="form-label">Secret ที่บันทึกล่าสุดในฐานข้อมูล</label>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input type="text" className="form-input" value={savedSecret || "- ยังไม่มีข้อมูล -"} readOnly style={{ fontFamily: "monospace" }} />
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-title">Railway Variables Instructions</div>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Variable</th>
                            <th>คำอธิบาย</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>JWT_SECRET</code></td>
                            <td>Copy ค่าจาก "Secret ที่บันทึกล่าสุด" ไปใส่ใน Railway Variables แล้ว Redeploy</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
