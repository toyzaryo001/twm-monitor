"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../components/Toast";

export default function SettingsPage() {
    const { showToast } = useToast();
    const [jwtSecret, setJwtSecret] = useState("");
    const [savedSecret, setSavedSecret] = useState("");
    const [currentEnvSecret, setCurrentEnvSecret] = useState("");
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);

    // Webhook Feature Toggle
    const [savedWebhookEnabled, setSavedWebhookEnabled] = useState("true");
    const [toggling, setToggling] = useState(false);

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
                if (data.data.WEBHOOK_FEATURE_ENABLED) setSavedWebhookEnabled(data.data.WEBHOOK_FEATURE_ENABLED);
            }
        } catch (e) {
            console.error("Error fetching settings", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const generateAndSaveSecret = async () => {
        if (!confirm("ต้องการสร้างและบันทึก Secret ใหม่ใช่หรือไม่?")) return;

        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const secret = Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");

        const token = getToken();
        if (!token) return;

        try {
            const res = await fetch("/api/master/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ key: "JWT_SECRET", value: secret })
            });
            const data = await res.json();
            if (data.ok) {
                setSavedSecret(secret);
                showToast({ type: "success", title: "สำเร็จ", message: "สร้างและบันทึก JWT Secret ใหม่เรียบร้อย" });
            } else {
                showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: "ไม่สามารถบันทึกข้อมูลได้" });
            }
        } catch (e) {
            showToast({ type: "error", title: "ข้อผิดพลาด", message: "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
        }
    };

    const toggleWebhookFeature = async () => {
        const newValue = savedWebhookEnabled === "true" ? "false" : "true";
        setToggling(true);
        const token = getToken();

        try {
            const res = await fetch("/api/master/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ key: "WEBHOOK_FEATURE_ENABLED", value: newValue })
            });
            const data = await res.json();
            if (data.ok) {
                setSavedWebhookEnabled(newValue);
                showToast({ type: "success", title: "สำเร็จ", message: `บันทึกสถานะ: ${newValue === "true" ? "เปิดใช้งาน" : "ปิดใช้งาน"} เรียบร้อย` });
            } else {
                showToast({ type: "error", title: "ผิดพลาด", message: "บันทึกไม่สำเร็จ" });
            }
        } catch (e) {
            showToast({ type: "error", title: "ผิดพลาด", message: "เกิดข้อผิดพลาด" });
        }
        setToggling(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        showToast({ type: "info", title: "คัดลอกแล้ว", message: "คัดลอกข้อวามลงคลิปบอร์ดแล้ว" });
        setTimeout(() => setCopied(false), 2000);
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
                </div>
            </div>

            {/* Generator & Storage */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-title">จัดการ JWT Secret</div>
                <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
                    จัดการ Secret สำหรับใส่ใน Railway Variables
                </p>

                <div className="form-group">
                    <label className="form-label">Secret ที่บันทึกล่าสุดในฐานข้อมูล</label>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        <input type="text" className="form-input" value={savedSecret || "- ยังไม่มีข้อมูล -"} readOnly style={{ fontFamily: "monospace" }} />
                        {savedSecret && (
                            <button className="btn btn-secondary" onClick={() => copyToClipboard(savedSecret)}>
                                {copied ? "✓" : "คัดลอก"}
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    <button className="btn btn-primary" onClick={generateAndSaveSecret} style={{ width: "100%" }}>
                        ⚡ สร้างและบันทึก Secret ใหม่ทันที
                    </button>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8, textAlign: "center" }}>
                        เมื่อกดปุ่มนี้ ระบบจะสร้าง Secret ใหม่และบันทึกลงฐานข้อมูลทันที
                    </p>
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
