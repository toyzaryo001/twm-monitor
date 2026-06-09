"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "../../../components/Toast";

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
    isAutoReceiveEnabled?: boolean;
}

interface AccountInfo {
    id: string;
    name: string;
    phoneNumber?: string;
    isActive: boolean;
    webhookSecret?: string | null;
}

export default function TenantSettingsPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const { showToast } = useToast();
    const [network, setNetwork] = useState<NetworkInfo | null>(null);
    const [accounts, setAccounts] = useState<AccountInfo[]>([]);
    const [loading, setLoading] = useState(true);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    useEffect(() => {
        const fetchSettings = async () => {
            const token = getToken();
            if (!token) return;

            try {
                const [statsRes, accountsRes] = await Promise.all([
                    fetch(`/api/tenant/${prefix}/stats`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`/api/tenant/${prefix}/accounts`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);

                const statsData = await statsRes.json();
                if (statsData.ok && statsData.data.network) {
                    setNetwork(statsData.data.network);
                }

                const accountsData = await accountsRes.json();
                if (accountsData.ok) {
                    setAccounts(accountsData.data);
                }
            } catch (e) {
                console.error("Error fetching settings", e);
            }
            setLoading(false);
        };

        fetchSettings();
    }, [prefix]);

    const getWebhookUrl = (phoneNumber?: string) => {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        return `${origin}/api/webhook/${prefix}?mobile=${phoneNumber || "08x..."}`;
    };

    const maskSecret = (secret?: string | null) => {
        if (!secret) return "ยังไม่ได้ตั้งค่า";
        if (secret.length <= 10) return `${secret.slice(0, 2)}••••${secret.slice(-2)}`;
        return `${secret.slice(0, 6)}••••••••${secret.slice(-6)}`;
    };

    const copyText = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            showToast({ type: "success", title: "คัดลอกแล้ว", message: label });
        } catch {
            showToast({ type: "error", title: "คัดลอกไม่สำเร็จ", message: "เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ" });
        }
    };

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

            {/* Webhook Integration - Only show if enabled globally */}
            {(network?.isAutoReceiveEnabled !== false) && (
                <div className="tenant-card" style={{ marginBottom: 24 }}>
                    <div className="settings-section">
                        <div className="settings-section-title">🔗 Webhook รับค่าธรรมเนียมและถอนเงิน</div>
                        <div className="webhook-guide">
                            <div>
                                <div className="webhook-guide-title">ตั้งค่าในแอพ TrueMoney ต่อวอลเล็ท</div>
                                <div className="webhook-guide-text">
                                    ใช้ Endpoint URL ของเบอร์นั้น ๆ และใส่ Header name เป็น <code>Authorization</code>
                                    ส่วน Header key ให้นำค่าจากหน้าแจ้งหักค่าธรรมเนียมมาใส่ในช่อง Webhook Header Key ที่หน้าแก้ไขวอลเล็ท
                                </div>
                            </div>
                            <a className="tenant-btn tenant-btn-secondary tenant-btn-sm" href={`/tenant/${prefix}/wallets`}>
                                ไปจัดการวอลเล็ท
                            </a>
                        </div>

                        {accounts.length === 0 ? (
                            <div className="webhook-empty">
                                ยังไม่มีวอลเล็ทสำหรับสร้าง Endpoint URL
                            </div>
                        ) : (
                            <div className="webhook-account-list">
                                {accounts.map((account) => {
                                    const url = getWebhookUrl(account.phoneNumber);
                                    return (
                                        <div className="webhook-account-card" key={account.id}>
                                            <div className="webhook-account-head">
                                                <div>
                                                    <div className="webhook-account-name">{account.name}</div>
                                                    <div className="webhook-account-phone">{account.phoneNumber || "ยังไม่ระบุเบอร์"}</div>
                                                </div>
                                                <span className={account.webhookSecret ? "webhook-status ready" : "webhook-status missing"}>
                                                    {account.webhookSecret ? "พร้อมตรวจ Header" : "ยังไม่ใส่ Header Key"}
                                                </span>
                                            </div>

                                            <div className="webhook-field">
                                                <div className="webhook-field-label">Endpoint URL</div>
                                                <div className="webhook-code-row">
                                                    <code>{url}</code>
                                                    <button type="button" onClick={() => copyText(url, "Endpoint URL")}>คัดลอก</button>
                                                </div>
                                            </div>

                                            <div className="webhook-field-grid">
                                                <div className="webhook-field">
                                                    <div className="webhook-field-label">Header Name</div>
                                                    <div className="webhook-code-row">
                                                        <code>Authorization</code>
                                                        <button type="button" onClick={() => copyText("Authorization", "Header Name")}>คัดลอก</button>
                                                    </div>
                                                </div>
                                                <div className="webhook-field">
                                                    <div className="webhook-field-label">Header Key</div>
                                                    <div className="webhook-code-row">
                                                        <code>{maskSecret(account.webhookSecret)}</code>
                                                        <button
                                                            type="button"
                                                            disabled={!account.webhookSecret}
                                                            onClick={() => account.webhookSecret && copyText(account.webhookSecret, "Header Key")}
                                                        >
                                                            คัดลอก
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

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
