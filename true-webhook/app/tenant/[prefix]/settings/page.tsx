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
    currentPackage?: string | null;
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
                const [statsRes, versionRes] = await Promise.all([
                    fetch(`/api/tenant/${prefix}/stats`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch("/api/version"),
                ]);

                const statsData = await statsRes.json();
                if (statsData.ok && statsData.data.network) {
                    setNetwork(statsData.data.network);
                    setTenantName(statsData.data.network.name || "");
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
        <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 60 }}>
            {/* Header */}
            <div className="tenant-page-header" style={{ marginBottom: 24 }}>
                <h1 className="tenant-page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span>⚙️</span> ตั้งค่าระบบ
                </h1>
                <div style={{ color: "var(--theme-text-muted)", fontSize: "0.85rem", marginTop: 4 }}>
                    จัดการข้อมูลเครือข่าย, ภาพลักษณ์โลโก้, การตรวจสอบยอดเงิน Real-time และการแจ้งเตือน
                </div>
            </div>

            {/* 1. Tenant Branding & Identity Management */}
            <div className="tenant-card" style={{ marginBottom: 24, padding: "24px 26px" }}>
                <div className="settings-section">
                    <div className="settings-section-title" style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 4 }}>
                        🏢 ข้อมูลและภาพลักษณ์เครือข่าย (Branding)
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--theme-text-muted)", marginBottom: 18 }}>
                        ตั้งค่าชื่อและโลโก้ที่จะแสดงบนแถบเมนูข้าง (Sidebar) และหน้าเข้าสู่ระบบ รองรับภาพโลโก้ได้ทุกขนาดและทุกอัตราส่วน
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                        {/* Logo Upload Section - Multi-aspect Ratio Support (1:1, 4:3, 16:9, 9:16) */}
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 14,
                            padding: "18px 20px",
                            borderRadius: 12,
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid var(--theme-border-subtle)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span className="tenant-form-label" style={{ margin: 0, fontWeight: 600 }}>โลโก้เครือข่าย (Logo)</span>
                                <span style={{
                                    fontSize: "0.72rem",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    background: "rgba(16, 185, 129, 0.12)",
                                    color: "#10b981",
                                    border: "1px solid rgba(16, 185, 129, 0.25)",
                                    fontWeight: 500
                                }}>
                                    รองรับ 1:1, 4:3, 16:9, 9:16
                                </span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                                {/* Multi-ratio Logo Preview Canvas */}
                                <div style={{
                                    width: 130,
                                    height: 84,
                                    borderRadius: 10,
                                    border: "1px solid var(--theme-border)",
                                    background: "#141417",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: 6,
                                    overflow: "hidden",
                                    boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.4)",
                                    flexShrink: 0
                                }}>
                                    {currentLogoDisplay ? (
                                        <img
                                            src={currentLogoDisplay}
                                            alt="Network Logo"
                                            style={{
                                                maxWidth: "100%",
                                                maxHeight: "100%",
                                                width: "auto",
                                                height: "auto",
                                                objectFit: "contain",
                                                borderRadius: 4,
                                                display: "block"
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 8,
                                            background: "var(--theme-accent)",
                                            color: "var(--theme-accent-fg)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontWeight: 800,
                                            fontSize: 20,
                                        }}>
                                            {initials}
                                        </div>
                                    )}
                                </div>

                                {/* Controls */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 160 }}>
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
                                            style={{ height: 32, fontSize: "0.8rem" }}
                                        >
                                            📁 เลือกรูปภาพ...
                                        </button>

                                        {logoFile && (
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-primary tenant-btn-sm"
                                                onClick={handleUploadLogo}
                                                disabled={uploadingLogo}
                                                style={{ height: 32, fontSize: "0.8rem" }}
                                            >
                                                {uploadingLogo ? "กำลังอัปโหลด..." : "💾 บันทึกโลโก้"}
                                            </button>
                                        )}

                                        {network?.logoUrl && !logoFile && (
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                style={{ color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)", height: 32, fontSize: "0.8rem" }}
                                                onClick={handleDeleteLogo}
                                                disabled={uploadingLogo}
                                            >
                                                ลบโลโก้
                                            </button>
                                        )}
                                    </div>
                                    <span style={{ fontSize: "0.72rem", color: "var(--theme-text-muted)", lineHeight: 1.4 }}>
                                        รองรับภาพทุกสัดส่วน (1:1 จัตุรัส, 4:3 แนวนอน, 16:9 แบนเนอร์, 9:16 แนวตั้ง) ระบบจะคงสัดส่วนเดิมไว้ 100% ไม่ถูกตัดขอบ (JPG, PNG, WEBP, SVG สูงสุด 5MB)
                                    </span>
                                </div>
                            </div>

                            {/* Live Sidebar Preview */}
                            <div style={{
                                marginTop: 4,
                                padding: "10px 14px",
                                borderRadius: 8,
                                background: "rgba(0, 0, 0, 0.25)",
                                border: "1px dashed var(--theme-border-subtle)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12
                            }}>
                                <span style={{ fontSize: "0.75rem", color: "var(--theme-text-muted)" }}>
                                    ตัวอย่างการแสดงผลบนแถบเมนูด้านซ้าย (Sidebar):
                                </span>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "6px 12px",
                                    background: "#09090b",
                                    border: "1px solid var(--theme-border)",
                                    borderRadius: 8
                                }}>
                                    <div className="tenant-logo-container" style={{ width: 44, height: 38 }}>
                                        {currentLogoDisplay ? (
                                            <img
                                                src={currentLogoDisplay}
                                                alt="Preview"
                                                className="tenant-logo-img"
                                            />
                                        ) : (
                                            <div className="tenant-logo-placeholder" style={{ width: 34, height: 34, fontSize: 13 }}>
                                                {initials}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fafafa", lineHeight: 1.2 }}>
                                            {tenantName || network?.name || prefix.toUpperCase()}
                                        </span>
                                        <span style={{ fontSize: "0.68rem", color: "#10b981", fontWeight: 600 }}>
                                            {network?.currentPackage ? network.currentPackage.toUpperCase() : "PRO"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tenant Name Section */}
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: 14,
                            padding: "18px 20px",
                            borderRadius: 12,
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid var(--theme-border-subtle)"
                        }}>
                            <div>
                                <div className="tenant-form-label" style={{ fontWeight: 600, marginBottom: 6 }}>ชื่อเครือข่าย (Tenant Name)</div>
                                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                                    <input
                                        type="text"
                                        className="tenant-input"
                                        value={tenantName}
                                        onChange={(e) => setTenantName(e.target.value)}
                                        placeholder="เช่น JGA88, Auto Monitor..."
                                        maxLength={50}
                                        style={{ height: 40 }}
                                    />
                                    <button
                                        type="button"
                                        className="tenant-btn tenant-btn-primary"
                                        onClick={handleSaveName}
                                        disabled={savingName || tenantName.trim() === network?.name}
                                        style={{ whiteSpace: "nowrap", height: 40, padding: "0 18px", fontSize: "0.85rem" }}
                                    >
                                        {savingName ? "กำลังบันทึก..." : "บันทึกชื่อ"}
                                    </button>
                                </div>
                                <span style={{ fontSize: "0.72rem", color: "var(--theme-text-muted)" }}>
                                    ชื่อนี้จะแสดงบนแถบเมนูด้านซ้ายและส่วนหัวของระบบ
                                </span>
                            </div>

                            <div style={{ paddingTop: 12, borderTop: "1px solid var(--theme-border-subtle)" }}>
                                <div className="settings-row" style={{ padding: "6px 0" }}>
                                    <span className="settings-label" style={{ fontSize: "0.82rem" }}>Prefix สำหรับเข้าสู่ระบบ</span>
                                    <span className="settings-value" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{prefix}</span>
                                </div>
                                <div className="settings-row" style={{ padding: "6px 0" }}>
                                    <span className="settings-label" style={{ fontSize: "0.82rem" }}>สถานะเครือข่าย</span>
                                    <span className={`badge ${network?.isActive ? "badge-success" : "badge-error"}`} style={{ fontSize: "0.75rem" }}>
                                        {network?.isActive ? "เปิดใช้งานปกติ" : "ปิดใช้งาน"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Real-time Monitoring Settings */}
            <div className="tenant-card" style={{ marginBottom: 24, padding: "20px 24px" }}>
                <div className="settings-section">
                    <div className="settings-section-title" style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 12 }}>
                        ⚡ การตรวจสอบยอดเงิน Real-time
                    </div>
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

            {/* 3. Telegram Notifications */}
            <div className="tenant-card" style={{ marginBottom: 24, padding: "20px 24px" }}>
                <div className="settings-section">
                    <div className="settings-section-title" style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 12 }}>
                        🔔 การแจ้งเตือน Telegram Bot
                    </div>
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
                            padding: "16px",
                            textAlign: "center",
                            color: "var(--theme-text-muted)",
                            fontSize: "0.85rem"
                        }}>
                            หากต้องการเปิดใช้งานการแจ้งเตือนผ่าน Telegram กรุณาติดต่อผู้ดูแลระบบ (Master Admin)
                        </div>
                    )}
                </div>
            </div>

            {/* 4. System Details */}
            <div className="tenant-card" style={{ padding: "20px 24px" }}>
                <div className="settings-section">
                    <div className="settings-section-title" style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 12 }}>
                        ℹ️ ข้อมูลระบบและการเชื่อมต่อ
                    </div>
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
