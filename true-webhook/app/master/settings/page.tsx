"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../components/Toast";
import { masterFetch } from "../../lib/masterFetch";
import { ConfirmModal, PageHeader } from "../components/MasterUI";

export default function SettingsPage() {
    const { showToast } = useToast();
    const [savedSecret, setSavedSecret] = useState("");
    const [currentEnvSecret, setCurrentEnvSecret] = useState("");
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savedWebhookEnabled, setSavedWebhookEnabled] = useState("true");
    const [toggling, setToggling] = useState(false);
    const [confirmSecret, setConfirmSecret] = useState(false);

    const fetchSettings = async () => {
        try {
            const data = await masterFetch<{ ok: true; data: Record<string, string> }>("/api/master/settings");
            if (data.data.JWT_SECRET) setSavedSecret(data.data.JWT_SECRET);
            if (data.data.currentJwtSecret) setCurrentEnvSecret(data.data.currentJwtSecret);
            if (data.data.WEBHOOK_FEATURE_ENABLED) setSavedWebhookEnabled(data.data.WEBHOOK_FEATURE_ENABLED);
        } catch (error) {
            showToast({ type: "error", title: "โหลดตั้งค่าไม่สำเร็จ", message: error instanceof Error ? error.message : "SETTINGS_LOAD_FAILED" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const generateAndSaveSecret = async () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const secret = Array.from(array).map((byte) => byte.toString(16).padStart(2, "0")).join("");

        try {
            await masterFetch("/api/master/settings", {
                method: "POST",
                body: JSON.stringify({ key: "JWT_SECRET", value: secret }),
            });
            setSavedSecret(secret);
            setConfirmSecret(false);
            showToast({ type: "success", title: "สร้าง Secret แล้ว", message: "นำค่าไปใส่ Railway Variables แล้ว redeploy เพื่อใช้งานจริง" });
        } catch (error) {
            showToast({ type: "error", title: "บันทึกไม่สำเร็จ", message: error instanceof Error ? error.message : "JWT_SECRET_SAVE_FAILED" });
        }
    };

    const toggleWebhookFeature = async () => {
        const newValue = savedWebhookEnabled === "true" ? "false" : "true";
        setToggling(true);
        try {
            await masterFetch("/api/master/settings", {
                method: "POST",
                body: JSON.stringify({ key: "WEBHOOK_FEATURE_ENABLED", value: newValue }),
            });
            setSavedWebhookEnabled(newValue);
            showToast({ type: "success", title: "บันทึกสำเร็จ", message: newValue === "true" ? "เปิด webhook แล้ว" : "ปิด webhook แล้ว" });
        } catch (error) {
            showToast({ type: "error", title: "บันทึกไม่สำเร็จ", message: error instanceof Error ? error.message : "WEBHOOK_TOGGLE_FAILED" });
        } finally {
            setToggling(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        showToast({ type: "info", title: "คัดลอกแล้ว" });
        setTimeout(() => setCopied(false), 1800);
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    const runtimeMatchesSaved = Boolean(currentEnvSecret && savedSecret && currentEnvSecret === savedSecret);

    return (
        <div>
            <PageHeader
                eyebrow="System Settings"
                title="ตั้งค่าระบบ"
                description="จัดการค่า shared ของระบบโดยไม่แตะ schema ฐานข้อมูล"
            />

            <div className="master-grid">
                <div style={{ gridColumn: "span 7" }}>
                    <div className="card" style={{ marginBottom: 18 }}>
                        <div className="card-title">สถานะ JWT Secret</div>
                        <div className="master-panel" style={{ marginBottom: 14 }}>
                            <div className="form-label">Runtime Secret</div>
                            <div style={{ display: "flex", gap: 10 }}>
                                <input className="form-input" value={currentEnvSecret || "-"} readOnly style={{ fontFamily: "monospace", color: runtimeMatchesSaved ? "var(--success)" : "var(--warning)" }} />
                                {currentEnvSecret && <button className="btn btn-secondary" onClick={() => copyToClipboard(currentEnvSecret)}>คัดลอก</button>}
                            </div>
                            <div className="form-hint">
                                {runtimeMatchesSaved ? "Runtime ตรงกับค่าที่บันทึกไว้" : "Runtime อาจยังไม่ตรงกับค่าที่บันทึกไว้ ต้องอัปเดต Railway และ redeploy"}
                            </div>
                        </div>
                        <div className="master-panel">
                            <div className="form-label">Saved Secret</div>
                            <div style={{ display: "flex", gap: 10 }}>
                                <input className="form-input" value={savedSecret || "- ยังไม่มีข้อมูล -"} readOnly style={{ fontFamily: "monospace" }} />
                                {savedSecret && <button className="btn btn-secondary" onClick={() => copyToClipboard(savedSecret)}>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</button>}
                            </div>
                        </div>
                        <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => setConfirmSecret(true)}>
                            สร้าง JWT Secret ใหม่
                        </button>
                    </div>
                </div>

                <div style={{ gridColumn: "span 5" }}>
                    <div className="card" style={{ marginBottom: 18 }}>
                        <div className="card-title">Webhook Feature</div>
                        <label className="master-toggle-row">
                            <div>
                                <div style={{ fontWeight: 850 }}>รับ webhook เข้าระบบ</div>
                                <div className="form-hint">ใช้ควบคุม feature flag ระดับระบบ</div>
                            </div>
                            <input type="checkbox" checked={savedWebhookEnabled === "true"} onChange={toggleWebhookFeature} disabled={toggling} />
                        </label>
                    </div>

                    <div className="card">
                        <div className="card-title">Railway Variables</div>
                        <table className="table" style={{ minWidth: 0 }}>
                            <tbody>
                                <tr>
                                    <td><code>JWT_SECRET</code></td>
                                    <td>ใส่ค่า Saved Secret ใน Railway แล้ว redeploy</td>
                                </tr>
                                <tr>
                                    <td><code>HEALTH_CHECK_SECRET</code></td>
                                    <td>ใช้เรียก deep health endpoint</td>
                                </tr>
                                <tr>
                                    <td><code>CORS_ORIGINS</code></td>
                                    <td>allowlist origin production</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {confirmSecret && (
                <ConfirmModal
                    title="สร้าง JWT Secret ใหม่?"
                    message="ระบบจะบันทึก secret ใหม่ไว้ในฐานข้อมูล แต่ต้องนำไปใส่ Railway Variables และ redeploy เอง"
                    confirmText="สร้างใหม่"
                    tone="success"
                    onCancel={() => setConfirmSecret(false)}
                    onConfirm={generateAndSaveSecret}
                />
            )}
        </div>
    );
}
