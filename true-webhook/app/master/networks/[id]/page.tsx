"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "../../../components/Toast";

interface Network {
    id: string;
    prefix: string;
    name: string;
    logoUrl: string | null;
    isActive: boolean;
    realtimeEnabled: boolean;
    checkIntervalMs: number;
    featureWebhookEnabled: boolean;
    telegramBotToken: string | null;
    telegramChatId: string | null;
    telegramEnabled: boolean;
    notifyMoneyIn: boolean;
    notifyMoneyOut: boolean;
    notifyMinAmount: number;
    _count: { users: number; accounts: number };
}

export default function NetworkSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const networkId = params.id as string;
    const { showToast } = useToast();

    const [network, setNetwork] = useState<Network | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: "",
        logoUrl: "",
        isActive: true,
        isActive: true,
        realtimeEnabled: true,
        checkIntervalMs: 2000,
        featureWebhookEnabled: true,
        telegramBotToken: "",
        telegramChatId: "",
        telegramEnabled: false,
        notifyMoneyIn: true,
        notifyMoneyOut: true,
        notifyMinAmount: 0,
    });

    const getToken = () => localStorage.getItem("token") || "";

    const fetchNetwork = async () => {
        const token = getToken();
        if (!token) return;

        try {
            const res = await fetch(`/api/master/networks/${networkId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.ok) {
                setNetwork(data.data);
                setForm({
                    name: data.data.name,
                    logoUrl: data.data.logoUrl || "",
                    isActive: data.data.isActive,
                    realtimeEnabled: data.data.realtimeEnabled ?? true,
                    checkIntervalMs: data.data.checkIntervalMs ?? 2000,
                    featureWebhookEnabled: data.data.featureWebhookEnabled ?? true,
                    telegramBotToken: data.data.telegramBotToken || "",
                    telegramChatId: data.data.telegramChatId || "",
                    telegramEnabled: data.data.telegramEnabled ?? false,
                    notifyMoneyIn: data.data.notifyMoneyIn ?? true,
                    notifyMoneyOut: data.data.notifyMoneyOut ?? true,
                    notifyMinAmount: data.data.notifyMinAmount ?? 0,
                });
            }
        } catch (e) {
            console.error("Error fetching network:", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchNetwork();
    }, [networkId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const token = getToken();

        try {
            const res = await fetch(`/api/master/networks/${networkId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.ok) {
                showToast({ type: "success", title: "บันทึกสำเร็จ!", message: "การตั้งค่าได้รับการบันทึกแล้ว" });
                fetchNetwork();
            } else {
                showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: data.error || "ไม่สามารถบันทึกการตั้งค่าได้" });
            }
        } catch (e) {
            showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
        }
        setSaving(false);
    };

    const handleTestTelegram = async () => {
        const token = getToken();
        try {
            const res = await fetch(`/api/master/networks/${networkId}/test-telegram`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.ok) {
                showToast({ type: "success", title: "ส่งข้อความทดสอบสำเร็จ!", message: "ตรวจสอบ Telegram ของคุณ" });
            } else {
                showToast({ type: "error", title: "ส่งไม่สำเร็จ", message: data.error || "ไม่สามารถส่งข้อความได้" });
            }
        } catch (e) {
            showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
        }
    };

    if (loading) {
        return <div className="loading"><div className="spinner" /></div>;
    }

    if (!network) {
        return <div className="card">ไม่พบเครือข่าย</div>;
    }

    return (
        <div>
            <div className="page-header">
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <Link href="/master/networks" className="btn btn-secondary" style={{ padding: "8px 12px" }}>
                        ← กลับ
                    </Link>
                    <h1 className="page-title">ตั้งค่า: {network.name}</h1>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <span style={{
                        padding: "4px 12px",
                        borderRadius: 6,
                        background: network.isActive ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: network.isActive ? "#22c55e" : "#ef4444",
                        fontSize: 13
                    }}>
                        {network.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </span>
                    <span style={{
                        padding: "4px 12px",
                        borderRadius: 6,
                        background: "rgba(99, 102, 241, 0.2)",
                        color: "#818cf8",
                        fontSize: 13,
                        fontFamily: "monospace"
                    }}>
                        {network.prefix}
                    </span>
                </div>
            </div>

            <form onSubmit={handleSave}>
                {/* Basic Settings */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 18, marginBottom: 20, color: "#a5b4fc" }}>📋 ข้อมูลทั่วไป</h2>

                    <div className="form-group">
                        <label className="form-label">ชื่อเครือข่าย</label>
                        <input
                            type="text"
                            className="form-input"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">ลิ้งค์ Logo (รูปภาพ URL)</label>
                        <input
                            type="url"
                            className="form-input"
                            value={form.logoUrl}
                            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                            placeholder="https://example.com/logo.png"
                        />
                        <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
                            ใส่ลิ้งค์รูปภาพ แนะนำ PNG, JPG ขนาด 100x100 ขึ้นไป
                        </p>
                        {form.logoUrl && (
                            <div style={{ marginTop: 12, padding: 12, background: "rgba(99, 102, 241, 0.1)", borderRadius: 12, display: "inline-block" }}>
                                <img
                                    src={form.logoUrl}
                                    alt="Logo Preview"
                                    style={{ maxWidth: 80, maxHeight: 80, borderRadius: 12 }}
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                style={{ width: 20, height: 20 }}
                            />
                            <span>เปิดใช้งานเครือข่าย</span>
                        </label>
                    </div>
                </div>

                {/* Real-time Settings */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 18, marginBottom: 20, color: "#a5b4fc" }}>⚡ การตรวจสอบยอดเงิน Real-time</h2>

                    <div className="form-group">
                        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={form.realtimeEnabled}
                                onChange={(e) => setForm({ ...form, realtimeEnabled: e.target.checked })}
                                style={{ width: 20, height: 20 }}
                            />
                            <span>เปิดใช้งาน Real-time Monitoring</span>
                        </label>
                        <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
                            ระบบจะเช็คยอดเงินอัตโนมัติตามความถี่ที่กำหนด
                        </p>
                    </div>

                    {form.realtimeEnabled && (
                        <div className="form-group">
                            <label className="form-label">ความถี่ในการเช็คยอด</label>
                            <select
                                className="form-input"
                                value={form.checkIntervalMs}
                                onChange={(e) => setForm({ ...form, checkIntervalMs: parseInt(e.target.value) })}
                            >
                                <option value={1000}>ทุก 1 วินาที (เร็วที่สุด)</option>
                                <option value={2000}>ทุก 2 วินาที</option>
                                <option value={5000}>ทุก 5 วินาที</option>
                                <option value={10000}>ทุก 10 วินาที</option>
                                <option value={30000}>ทุก 30 วินาที</option>
                                <option value={60000}>ทุก 1 นาที</option>
                            </select>
                            <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
                                ⚠️ ยิ่งเร็วยิ่งใช้ทรัพยากรมาก และอาจถูก rate limit จาก API
                            </p>
                        </div>
                    )}
                </div>

                {/* Feature Toggles */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 18, marginBottom: 20, color: "#a5b4fc" }}>🔗 การเชื่อมต่อ Webhook</h2>
                    <div className="form-group">
                        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={form.featureWebhookEnabled}
                                onChange={(e) => setForm({ ...form, featureWebhookEnabled: e.target.checked })}
                                style={{ width: 20, height: 20 }}
                            />
                            <span>เปิดใช้งาน Webhook (รับยอดอัตโนมัติ)</span>
                        </label>
                        <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
                            เมื่อปิดใช้งาน เมนู "Webhook" ในหน้าตั้งค่าของ Tenant จะถูกซ่อน
                        </p>
                    </div>
                </div>

                {/* Telegram Settings */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 18, marginBottom: 20, color: "#a5b4fc" }}>🔔 การแจ้งเตือน Telegram</h2>

                    <div className="form-group">
                        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={form.telegramEnabled}
                                onChange={(e) => setForm({ ...form, telegramEnabled: e.target.checked })}
                                style={{ width: 20, height: 20 }}
                            />
                            <span>เปิดใช้งาน Telegram แจ้งเตือน</span>
                        </label>
                    </div>

                    {form.telegramEnabled && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Bot Token</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={form.telegramBotToken}
                                    onChange={(e) => setForm({ ...form, telegramBotToken: e.target.value })}
                                    placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                                    style={{ fontFamily: "monospace" }}
                                />
                                <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
                                    รับจาก @BotFather บน Telegram
                                </p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Chat ID</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={form.telegramChatId}
                                    onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
                                    placeholder="-1001234567890"
                                    style={{ fontFamily: "monospace" }}
                                />
                                <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
                                    ID ของ Group หรือ Channel ที่ต้องการส่งแจ้งเตือน
                                </p>
                            </div>

                            <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={form.notifyMoneyIn}
                                        onChange={(e) => setForm({ ...form, notifyMoneyIn: e.target.checked })}
                                    />
                                    <span>💚 แจ้งเตือนเมื่อเงินเข้า</span>
                                </label>

                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={form.notifyMoneyOut}
                                        onChange={(e) => setForm({ ...form, notifyMoneyOut: e.target.checked })}
                                    />
                                    <span>❤️ แจ้งเตือนเมื่อเงินออก</span>
                                </label>
                            </div>

                            <div className="form-group" style={{ marginTop: 16 }}>
                                <label className="form-label">จำนวนเงินขั้นต่ำที่จะแจ้งเตือน (บาท)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={form.notifyMinAmount / 100}
                                    onChange={(e) => setForm({ ...form, notifyMinAmount: parseFloat(e.target.value) * 100 || 0 })}
                                    min={0}
                                    step={1}
                                    placeholder="0"
                                />
                                <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
                                    ถ้าใส่ 100 จะแจ้งเตือนเฉพาะยอดที่มากกว่า 100 บาท (0 = แจ้งทุกยอด)
                                </p>
                            </div>

                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleTestTelegram}
                                style={{ marginTop: 16 }}
                            >
                                📨 ทดสอบส่งข้อความ
                            </button>
                        </>
                    )}
                </div>

                {/* Save Button */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                    <Link href="/master/networks" className="btn btn-secondary">
                        ยกเลิก
                    </Link>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "กำลังบันทึก..." : "💾 บันทึกการตั้งค่า"}
                    </button>
                </div>
            </form>
        </div>
    );
}
