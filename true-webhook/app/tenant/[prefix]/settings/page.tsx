"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useToast } from "../../../components/Toast";

interface NetworkInfo {
    id: string;
    name: string;
    prefix: string;
    logoUrl?: string | null;
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
    webhookSecretConfigured?: boolean;
}

interface VersionInfo {
    version: string;
    commit: string | null;
    buildTime: string | null;
}

export default function TenantSettingsPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const { showToast } = useToast();
    const [network, setNetwork] = useState<NetworkInfo | null>(null);
    const [accounts, setAccounts] = useState<AccountInfo[]>([]);
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [loading, setLoading] = useState(true);

    // Tenant Profile Editing State
    const [tenantName, setTenantName] = useState("");
    const [savingName, setSavingName] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    useEffect(() => {
        const fetchSettings = async () => {
            const token = getToken();
            if (!token) return;

            try {
                const [statsRes, accountsRes, versionRes] = await Promise.all([
                    fetch(`/api/tenant/${prefix}/stats`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`/api/tenant/${prefix}/accounts`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch("/api/version"),
                ]);

                const statsData = await statsRes.json();
                if (statsData.ok && statsData.data.network) {
                    setNetwork(statsData.data.network);
                    setTenantName(statsData.data.network.name || "");
                }

                const accountsData = await accountsRes.json();
                if (accountsData.ok) {
                    setAccounts(accountsData.data);
                }

                if (versionRes.ok) {
                    setVersionInfo(await versionRes.json());
                }
            } catch (e) {
                console.error("Error fetching settings", e);
            }
            setLoading(false);
        };

        fetchSettings();
    }, [prefix]);

    // Save Tenant Name
    const handleSaveName = async () => {
        if (!tenantName.trim()) {
            showToast({ type: "error", title: "ข้อผิดพลาด", message: "กรุณาระบุชื่อเครือข่าย" });
            return;
        }

        setSavingName(true);
        const token = getToken();

        try {
            const res = await fetch(`/api/tenant/${prefix}/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name: tenantName.trim() }),
            });

            const data = await res.json();
            if (data.ok) {
                setNetwork(prev => prev ? ({ ...prev, name: data.data.name }) : prev);
                window.dispatchEvent(new CustomEvent("tenant-profile-updated", {
                    detail: { name: data.data.name }
                }));
                showToast({ type: "success", title: "สำเร็จ", message: "บันทึกชื่อเครือข่ายเรียบร้อยแล้ว" });
            } else {
                showToast({ type: "error", title: "ล้มเหลว", message: data.error || "ไม่สามารถบันทึกชื่อได้" });
            }
        } catch {
            showToast({ type: "error", title: "ล้มเหลว", message: "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
        }
        setSavingName(false);
    };

    // Handle File Selection
    const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast({ type: "error", title: "ขนาดไฟล์เกิน", message: "กรุณาเลือกไฟล์ขนาดไม่เกิน 5MB" });
            return;
        }

        setLogoFile(file);
        const reader = new FileReader();
        reader.onload = () => {
            setLogoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // Upload Logo File
    const handleUploadLogo = async () => {
        if (!logoFile) return;

        setUploadingLogo(true);
        const token = getToken();
        const formData = new FormData();
        formData.append("logo", logoFile);

        try {
            const res = await fetch(`/api/tenant/${prefix}/upload-logo`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const data = await res.json();
            if (data.ok) {
                setNetwork(prev => prev ? ({ ...prev, logoUrl: data.data.logoUrl }) : prev);
                setLogoFile(null);
                setLogoPreview(null);
                window.dispatchEvent(new CustomEvent("tenant-profile-updated", {
                    detail: { logoUrl: data.data.logoUrl }
                }));
                showToast({ type: "success", title: "สำเร็จ", message: "อัปโหลดโลโก้เรียบร้อยแล้ว" });
            } else {
                showToast({ type: "error", title: "ล้มเหลว", message: data.error || "ไม่สามารถอัปโหลดโลโก้ได้" });
            }
        } catch {
            showToast({ type: "error", title: "ล้มเหลว", message: "เกิดข้อผิดพลาดในการอัปโหลด" });
        }
        setUploadingLogo(false);
    };

    // Delete Logo
    const handleDeleteLogo = async () => {
        if (!confirm("คุณต้องการลบโลโก้ของเครือข่ายนี้หรือไม่?")) return;

        setUploadingLogo(true);
        const token = getToken();

        try {
            const res = await fetch(`/api/tenant/${prefix}/logo`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();
            if (data.ok) {
                setNetwork(prev => prev ? ({ ...prev, logoUrl: null }) : prev);
                setLogoPreview(null);
                setLogoFile(null);
                window.dispatchEvent(new CustomEvent("tenant-profile-updated", {
                    detail: { logoUrl: null }
                }));
                showToast({ type: "success", title: "สำเร็จ", message: "ลบรูปภาพโลโก้เรียบร้อยแล้ว" });
            } else {
                showToast({ type: "error", title: "ล้มเหลว", message: "ไม่สามารถลบโลโก้ได้" });
            }
        } catch {
            showToast({ type: "error", title: "ล้มเหลว", message: "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
        }
        setUploadingLogo(false);
    };

    const getWebhookUrl = (account: AccountInfo) => {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        if (account.webhookSecret || account.webhookSecretConfigured) return `${origin}/api/webhook/${prefix}`;
        return `${origin}/api/webhook/${prefix}?mobile=${account.phoneNumber || "08x..."}`;
    };

    const maskSecret = (secret?: string | null, configured = false) => {
        if (!secret) return configured ? "ตั้งค่าแล้ว (จำกัดสิทธิ์การดู)" : "ยังไม่ได้ตั้งค่า";
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

    const currentLogoDisplay = logoPreview || network?.logoUrl;
    const initials = (network?.name || prefix).slice(0, 2).toUpperCase();

    return (
        <div>
            <div className="tenant-page-header">
                <h1 className="tenant-page-title">ตั้งค่าระบบ</h1>
            </div>

            {/* 1. Tenant Branding & Identity Management */}
            <div className="tenant-card" style={{ marginBottom: 24 }}>
                <div className="settings-section">
                    <div className="settings-section-title">🏢 ข้อมูลและภาพลักษณ์เครือข่าย (Branding)</div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginTop: 12 }}>
                        {/* Logo Upload Section */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <div className="tenant-form-label">โลโก้เครือข่าย (Logo)</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                                {currentLogoDisplay ? (
                                    <img
                                        src={currentLogoDisplay}
                                        alt="Network Logo"
                                        style={{
                                            width: 72,
                                            height: 72,
                                            borderRadius: 10,
                                            objectFit: "cover",
                                            border: "1px solid var(--theme-border)",
                                            background: "var(--theme-surface)",
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: 10,
                                        background: "var(--theme-accent)",
                                        color: "var(--theme-accent-fg)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontWeight: 800,
                                        fontSize: 24,
                                        boxShadow: "var(--theme-shadow-sm)",
                                    }}>
                                        {initials}
                                    </div>
                                )}

                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleLogoFileChange}
                                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                        style={{ display: "none" }}
                                    />
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <button
                                            type="button"
                                            className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingLogo}
                                        >
                                            เลือกรูปภาพ...
                                        </button>

                                        {logoFile && (
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-primary tenant-btn-sm"
                                                onClick={handleUploadLogo}
                                                disabled={uploadingLogo}
                                            >
                                                {uploadingLogo ? "กำลังอัปโหลด..." : "บันทึกโลโก้"}
                                            </button>
                                        )}

                                        {network?.logoUrl && !logoFile && (
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                style={{ color: "var(--theme-error)", borderColor: "var(--theme-error-border)" }}
                                                onClick={handleDeleteLogo}
                                                disabled={uploadingLogo}
                                            >
                                                ลบโลโก้
                                            </button>
                                        )}
                                    </div>
                                    <span style={{ fontSize: 11, color: "var(--theme-text-muted)" }}>
                                        รองรับ JPG, PNG, WEBP, SVG ขนาดไม่เกิน 5MB
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Tenant Name Section */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div className="tenant-form-label">ชื่อเครือข่าย (Tenant Name)</div>
                            <div style={{ display: "flex", gap: 10 }}>
                                <input
                                    type="text"
                                    className="tenant-form-input"
                                    value={tenantName}
                                    onChange={(e) => setTenantName(e.target.value)}
                                    placeholder="เช่น JGA88, Auto Monitor..."
                                    maxLength={50}
                                />
                                <button
                                    type="button"
                                    className="tenant-btn tenant-btn-primary"
                                    onClick={handleSaveName}
                                    disabled={savingName || tenantName.trim() === network?.name}
                                    style={{ whiteSpace: "nowrap" }}
                                >
                                    {savingName ? "กำลังบันทึก..." : "บันทึกชื่อ"}
                                </button>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--theme-text-muted)" }}>
                                ชื่อนี้จะแสดงบนแถบเมนูด้านซ้ายและส่วนหัวของระบบ
                            </span>
                        </div>
                    </div>

                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--theme-border)" }}>
                        <div className="settings-row">
                            <span className="settings-label">Prefix สำหรับเข้าสู่ระบบ</span>
                            <span className="settings-value" style={{ fontFamily: "monospace" }}>{prefix}</span>
                        </div>
                        <div className="settings-row">
                            <span className="settings-label">สถานะเครือข่าย</span>
                            <span className={`badge ${network?.isActive ? "badge-success" : "badge-error"}`}>
                                {network?.isActive ? "เปิดใช้งานปกติ" : "ปิดใช้งาน"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Real-time Monitoring Settings */}
            <div className="tenant-card" style={{ marginBottom: 24 }}>
                <div className="settings-section">
                    <div className="settings-section-title">⚡ การตรวจสอบยอดเงิน Real-time</div>
                    <div className="settings-row">
                        <span className="settings-label">สถานะการเช็คยอดอัตโนมัติ</span>
                        <span className={`badge ${network?.realtimeEnabled ? "badge-success" : "badge-error"}`}>
                            {network?.realtimeEnabled ? "เปิดใช้งานอัตโนมัติ" : "ปิดใช้งาน"}
                        </span>
                    </div>
                    <div className="settings-row">
                        <span className="settings-label">ความถี่ในการตรวจสอบยอด</span>
                        <span className="settings-value">
                            {network?.checkIntervalMs ? getIntervalLabel(network.checkIntervalMs) : "-"}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. Webhook Integration */}
            {(network?.isAutoReceiveEnabled !== false) && (
                <div className="tenant-card" style={{ marginBottom: 24 }}>
                    <div className="settings-section">
                        <div className="settings-section-title">🔗 Webhook Endpoint สำหรับเชื่อมต่อ TrueMoney</div>
                        <div className="webhook-guide">
                            <div>
                                <div className="webhook-guide-title">คำแนะนำการตั้งค่าในระบบ TrueMoney</div>
                                <div className="webhook-guide-text">
                                    นำ Endpoint URL ด้านล่างไปกรอกในระบบ Webhook ของ TrueMoney โดยระบุ Header Name เป็น <code>Authorization</code> และใส่ Header Key ของแต่ละวอลเล็ท
                                </div>
                            </div>
                            <a className="tenant-btn tenant-btn-secondary tenant-btn-sm" href={`/tenant/${prefix}/wallets`}>
                                จัดการวอลเล็ท
                            </a>
                        </div>

                        {accounts.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--theme-text-muted)", fontSize: 13 }}>
                                ยังไม่มีบัญชีวอลเล็ทในเครือข่ายนี้ กรุณาเพิ่มวอลเล็ทก่อนสร้าง Webhook
                            </div>
                        ) : (
                            <div>
                                {accounts.map((account) => {
                                    const url = getWebhookUrl(account);
                                    const hasSecret = Boolean(account.webhookSecret || account.webhookSecretConfigured);
                                    return (
                                        <div className="webhook-account-card" key={account.id}>
                                            <div className="webhook-account-head">
                                                <div>
                                                    <div className="webhook-account-name">{account.name}</div>
                                                    <div className="webhook-account-phone">{account.phoneNumber || "ไม่ระบุเบอร์"}</div>
                                                </div>
                                                <span className={`badge ${hasSecret ? "badge-success" : "badge-warning"}`}>
                                                    {hasSecret ? "พร้อมรับ Authorization" : "ยังไม่ได้ตั้ง Header Key"}
                                                </span>
                                            </div>

                                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--theme-text-secondary)" }}>Endpoint URL</span>
                                                <div className="webhook-code-row">
                                                    <code>{url}</code>
                                                    <button type="button" onClick={() => copyText(url, "Endpoint URL")}>คัดลอก</button>
                                                </div>
                                            </div>

                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                                                <div>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--theme-text-secondary)" }}>Header Name</span>
                                                    <div className="webhook-code-row">
                                                        <code>Authorization</code>
                                                        <button type="button" onClick={() => copyText("Authorization", "Header Name")}>คัดลอก</button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--theme-text-secondary)" }}>Header Key</span>
                                                    <div className="webhook-code-row">
                                                        <code>{maskSecret(account.webhookSecret, account.webhookSecretConfigured)}</code>
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

            {/* 4. Telegram Notifications */}
            <div className="tenant-card" style={{ marginBottom: 24 }}>
                <div className="settings-section">
                    <div className="settings-section-title">🔔 การแจ้งเตือน Telegram Bot</div>
                    <div className="settings-row">
                        <span className="settings-label">สถานะการแจ้งเตือน</span>
                        <span className={`badge ${network?.telegramEnabled ? "badge-success" : "badge-neutral"}`}>
                            {network?.telegramEnabled ? "เปิดใช้งาน Telegram" : "ปิดใช้งาน"}
                        </span>
                    </div>

                    {network?.telegramEnabled ? (
                        <>
                            <div className="settings-row">
                                <span className="settings-label">Bot Token</span>
                                <span className="settings-value" style={{ fontFamily: "monospace" }}>
                                    {network?.telegramBotToken || "-"}
                                </span>
                            </div>
                            <div className="settings-row">
                                <span className="settings-label">Chat ID</span>
                                <span className="settings-value" style={{ fontFamily: "monospace" }}>
                                    {network?.telegramChatId || "-"}
                                </span>
                            </div>
                            <div className="settings-row">
                                <span className="settings-label">แจ้งเตือนยอดเงินเข้า</span>
                                <span className={`badge ${network?.notifyMoneyIn ? "badge-success" : "badge-neutral"}`}>
                                    {network?.notifyMoneyIn ? "เปิด" : "ปิด"}
                                </span>
                            </div>
                            <div className="settings-row">
                                <span className="settings-label">แจ้งเตือนยอดเงินออก</span>
                                <span className={`badge ${network?.notifyMoneyOut ? "badge-success" : "badge-neutral"}`}>
                                    {network?.notifyMoneyOut ? "เปิด" : "ปิด"}
                                </span>
                            </div>
                            <div className="settings-row">
                                <span className="settings-label">ยอดขั้นต่ำในการแจ้งเตือน</span>
                                <span className="settings-value">
                                    {network?.notifyMinAmount ? `฿ ${(network.notifyMinAmount / 100).toLocaleString()} ขึ้นไป` : "แจ้งเตือนทุกยอด"}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div style={{
                            padding: "20px",
                            textAlign: "center",
                            color: "var(--theme-text-muted)",
                            fontSize: 13
                        }}>
                            หากต้องการเปิดใช้งานการแจ้งเตือนผ่าน Telegram กรุณาติดต่อผู้ดูแลระบบ (Master Admin)
                        </div>
                    )}
                </div>
            </div>

            {/* 5. System Details */}
            <div className="tenant-card">
                <div className="settings-section">
                    <div className="settings-section-title">ℹ️ ข้อมูลระบบและการเชื่อมต่อ</div>
                    <div className="settings-row">
                        <span className="settings-label">เวอร์ชันระบบ</span>
                        <span className="settings-value">{versionInfo?.version || "1.0.1"}</span>
                    </div>
                    {versionInfo?.commit && (
                        <div className="settings-row">
                            <span className="settings-label">Commit SHA</span>
                            <span className="settings-value" style={{ fontFamily: "monospace" }}>{versionInfo.commit.slice(0, 8)}</span>
                        </div>
                    )}
                    <div className="settings-row">
                        <span className="settings-label">โดเมนหลักของเครือข่าย</span>
                        <span className="settings-value" style={{ fontFamily: "monospace" }}>{prefix}.tmw-monitors.com</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
