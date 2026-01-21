"use client";

import { useState } from "react";

export default function SettingsPage() {
    const [jwtSecret, setJwtSecret] = useState("");
    const [copied, setCopied] = useState(false);

    const generateSecret = () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const secret = Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
        setJwtSecret(secret);
        setCopied(false);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(jwtSecret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">ตั้งค่าระบบ</h1>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-title">JWT Secret Generator</div>
                <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
                    สร้าง JWT Secret สำหรับใช้ใน Railway Environment Variables
                </p>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <button className="btn btn-primary" onClick={generateSecret}>
                        🔑 สร้าง Secret ใหม่
                    </button>
                </div>
                {jwtSecret && (
                    <div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input type="text" className="form-input" value={jwtSecret} readOnly style={{ fontFamily: "monospace" }} />
                            <button className="btn btn-secondary" onClick={copyToClipboard}>
                                {copied ? "✓ คัดลอกแล้ว" : "คัดลอก"}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-title">ข้อมูลระบบ</div>
                <table className="table">
                    <tbody>
                        <tr>
                            <td style={{ fontWeight: 500 }}>Version</td>
                            <td>1.0.0</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 500 }}>Environment</td>
                            <td>{process.env.NODE_ENV || "unknown"}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="card">
                <div className="card-title">Railway Variables</div>
                <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
                    ตั้งค่า Environment Variables เหล่านี้ใน Railway:
                </p>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Variable</th>
                            <th>คำอธิบาย</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>DATABASE_URL</code></td>
                            <td>เชื่อมต่อ Postgres อัตโนมัติ</td>
                        </tr>
                        <tr>
                            <td><code>JWT_SECRET</code></td>
                            <td>ใช้ค่าที่ generate ด้านบน</td>
                        </tr>
                        <tr>
                            <td><code>RESET_DB</code></td>
                            <td>ตั้งเป็น true เพื่อ reset database (ลบหลังใช้งาน)</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
