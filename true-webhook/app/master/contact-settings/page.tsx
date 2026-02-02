"use client";

import { useState, useEffect } from "react";
import { useToast } from "../../components/Toast";

interface ContactSettings {
    lineId: string;
    lineUrl: string;
    facebookUrl: string;
    telegramUrl: string;
    phone: string;
    email: string;
}

export default function ContactSettingsPage() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<ContactSettings>({
        lineId: "",
        lineUrl: "",
        facebookUrl: "",
        telegramUrl: "",
        phone: "",
        email: ""
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/master/contact-settings", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) {
                setSettings(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/master/contact-settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (data.ok) {
                showToast({ title: "บันทึกสำเร็จ", type: "success" });
            } else {
                showToast({ title: "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (err) {
            showToast({ title: "เกิดข้อผิดพลาด", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">📞 ช่องทางติดต่อ</h1>
                <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
                    ตั้งค่าช่องทางติดต่อที่จะแสดงให้ลูกค้าเห็น
                </p>
            </div>

            <div className="card" style={{ maxWidth: 600 }}>
                <div className="card-header">
                    <h3 className="card-title">ตั้งค่าช่องทางติดต่อ</h3>
                </div>
                <div className="card-content">
                    <div className="form-group">
                        <label className="form-label">💚 LINE ID</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="@example"
                            value={settings.lineId}
                            onChange={(e) => setSettings({ ...settings, lineId: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">💚 LINE URL</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="https://line.me/ti/p/..."
                            value={settings.lineUrl}
                            onChange={(e) => setSettings({ ...settings, lineUrl: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">📘 Facebook URL</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="https://facebook.com/..."
                            value={settings.facebookUrl}
                            onChange={(e) => setSettings({ ...settings, facebookUrl: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">📱 Telegram URL</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="https://t.me/..."
                            value={settings.telegramUrl}
                            onChange={(e) => setSettings({ ...settings, telegramUrl: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">📞 เบอร์โทรศัพท์</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="0812345678"
                            value={settings.phone}
                            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">📧 อีเมล</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="contact@example.com"
                            value={settings.email}
                            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                        />
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                        style={{ marginTop: 16 }}
                    >
                        {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
                    </button>
                </div>
            </div>

            {/* Preview */}
            <div className="card" style={{ maxWidth: 600, marginTop: 24 }}>
                <div className="card-header">
                    <h3 className="card-title">👁️ ตัวอย่างการแสดงผล</h3>
                </div>
                <div className="card-content">
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {settings.lineId && (
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 20 }}>💚</span>
                                <span>LINE: {settings.lineId}</span>
                            </div>
                        )}
                        {settings.phone && (
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 20 }}>📞</span>
                                <span>โทร: {settings.phone}</span>
                            </div>
                        )}
                        {settings.email && (
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 20 }}>📧</span>
                                <span>อีเมล: {settings.email}</span>
                            </div>
                        )}
                        {settings.facebookUrl && (
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 20 }}>📘</span>
                                <span>Facebook</span>
                            </div>
                        )}
                        {settings.telegramUrl && (
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 20 }}>📱</span>
                                <span>Telegram</span>
                            </div>
                        )}
                        {!settings.lineId && !settings.phone && !settings.email && !settings.facebookUrl && !settings.telegramUrl && (
                            <div style={{ color: "var(--text-muted)" }}>ยังไม่มีช่องทางติดต่อ</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
