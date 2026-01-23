"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface NetworkInfo {
    id: string;
    name: string;
    prefix: string;
    isActive: boolean;
    realtimeEnabled: boolean;
    checkIntervalMs: number;
    telegramEnabled: boolean;
    telegramBotToken: string | null;
    telegramChatId: string | null;
    notifyMoneyIn: boolean;
    notifyMoneyOut: boolean;
    notifyMinAmount: number;
}

export default function TenantSettingsPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [network, setNetwork] = useState<NetworkInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    useEffect(() => {
        const fetchNetwork = async () => {
            const token = getToken();
            if (!token) return;

            try {
                const res = await fetch(`/api/tenant/${prefix}/stats`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.ok && data.data.network) {
                    setNetwork(data.data.network);
                }
            } catch (e) {
                console.error("Error fetching network", e);
            }
            setLoading(false);
        };

        fetchNetwork();
    }, [prefix]);

    const getIntervalLabel = (ms: number) => {
        if (ms <= 1000) return "ทุก 1 วินาที";
        if (ms <= 2000) return "ทุก 2 วินาที";
        if (ms <= 5000) return "ทุก 5 วินาที";
        if (ms <= 10000) return "ทุก 10 วินาที";
        if (ms <= 30000) return "ทุก 30 วินาที";
        return "ทุก 1 นาที";
    };

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            <div className="tenant-page-header">
                <h1 className="tenant-page-title">ตั้งค่า</h1>
            </div>

            {/* Network Info */}
            <div className="tenant-card" style={{ marginBottom: 24 }}>
                <div className="settings-section">
                    <div className="settings-section-title">ข้อมูลเครือข่าย</div>
                    <div className="settings-row">
                        <span className="settings-label">ชื่อ</span>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{network?.name || "-"}</span>
                    </div>
                    <div className="settings-row">
                        <span className="settings-label">Prefix</span>
                        <span className="settings-value">{prefix}</span>
                    </div>
                    <div className="settings-row">
                        <span className="settings-label">สถานะ</span>
                        <span style={{
                            padding: "4px 12px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: network?.isActive ? "var(--success-light)" : "rgba(239, 68, 68, 0.15)",
                            color: network?.isActive ? "var(--success)" : "var(--error)"
                        }}>
                            {network?.isActive ? "✓ เปิดใช้งาน" : "✕ ปิดใช้งาน"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Real-time Monitoring */}
            <div className="tenant-card" style={{ marginBottom: 24 }}>
                <div className="settings-section">
                    <div className="settings-section-title">⚡ การตรวจสอบ Real-time</div>
                    <div className="settings-row">
                        <span className="settings-label">สถานะ</span>
                        <span style={{
                            padding: "4px 12px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: network?.realtimeEnabled ? "var(--success-light)" : "rgba(239, 68, 68, 0.15)",
                            color: network?.realtimeEnabled ? "var(--success)" : "var(--error)"
                        }}>
                            {network?.realtimeEnabled ? "✓ เปิดใช้งาน" : "✕ ปิดใช้งาน"}
                        </span>
                    </div>
                    <div className="settings-row">
                        <span className="settings-label">ความถี่เช็คยอด</span>
                        <span style={{ color: "var(--accent)", fontWeight: 500 }}>
                            {network?.checkIntervalMs ? getIntervalLabel(network.checkIntervalMs) : "-"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Telegram Notifications */}
            <div className="tenant-card" style={{ marginBottom: 24 }}>
                <div className="settings-section">
                    <div className="settings-section-title">🔔 การแจ้งเตือน Telegram</div>
                    <div className="settings-row">
                        <span className="settings-label">สถานะ</span>
                        <span style={{
                            padding: "4px 12px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: network?.telegramEnabled ? "var(--success-light)" : "rgba(239, 68, 68, 0.15)",
                            color: network?.telegramEnabled ? "var(--success)" : "var(--error)"
                        }}>
                            {network?.telegramEnabled ? "✓ เปิดใช้งาน" : "✕ ปิดใช้งาน"}
                        </span>
                    </div>
                    {network?.telegramEnabled && (
                        <>
                            <div className="settings-row">
                                <span className="settings-label">Bot Token</span>
                                <span className="settings-value">
                                    {network?.telegramBotToken || "-"}
                                </span>
                            </div>
                            <div className="settings-row">
                                <span className="settings-label">Chat ID</span>
                                <span className="settings-value">
                                    {network?.telegramChatId || "-"}
                                </span>
                            </div>
                            <div className="settings-row">
                                <span className="settings-label">แจ้งเตือนเงินเข้า</span>
                                <span style={{ color: network?.notifyMoneyIn ? "var(--success)" : "var(--text-muted)" }}>
                                    {network?.notifyMoneyIn ? "✓ เปิด" : "✕ ปิด"}
                                </span>
                            </div>
                            <div className="settings-row">
                                <span className="settings-label">แจ้งเตือนเงินออก</span>
                                <span style={{ color: network?.notifyMoneyOut ? "var(--success)" : "var(--text-muted)" }}>
                                    {network?.notifyMoneyOut ? "✓ เปิด" : "✕ ปิด"}
                                </span>
                            </div>
                            <div className="settings-row">
                                <span className="settings-label">จำนวนขั้นต่ำ</span>
                                <span style={{ color: "var(--accent)" }}>
                                    {network?.notifyMinAmount ? `฿${(network.notifyMinAmount / 100).toLocaleString()}+` : "แจ้งทุกยอด"}
                                </span>
                            </div>
                        </>
                    )}
                    {!network?.telegramEnabled && (
                        <div style={{
                            padding: "20px",
                            textAlign: "center",
                            color: "var(--text-muted)",
                            fontSize: 14
                        }}>
                            ติดต่อผู้ดูแลระบบเพื่อเปิดใช้งาน Telegram แจ้งเตือน
                        </div>
                    )}
                </div>
            </div>

            {/* System Info */}
            <div className="tenant-card">
                <div className="settings-section">
                    <div className="settings-section-title">ข้อมูลระบบ</div>
                    <div className="settings-row">
                        <span className="settings-label">Version</span>
                        <span className="settings-value">1.0.0</span>
                    </div>
                    <div className="settings-row">
                        <span className="settings-label">Panel</span>
                        <span className="settings-value">Tenant Panel</span>
                    </div>
                    <div className="settings-row">
                        <span className="settings-label">URL</span>
                        <span className="settings-value">{prefix}.tmw-monitors.com</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
