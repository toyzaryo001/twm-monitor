"use client";

import { useParams } from "next/navigation";

export default function TenantSettingsPage() {
    const params = useParams();
    const prefix = params.prefix as string;

    return (
        <div>
            <div className="tenant-page-header">
                <h1 className="tenant-page-title">ตั้งค่า</h1>
            </div>

            <div className="tenant-card" style={{ marginBottom: 24 }}>
                <div className="tenant-card-title">ข้อมูลเครือข่าย</div>
                <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                        <span style={{ color: "var(--text-muted)", width: 120 }}>Prefix:</span>
                        <span style={{ fontFamily: "monospace", color: "var(--accent)" }}>{prefix}</span>
                    </div>
                </div>
            </div>

            <div className="tenant-card" style={{ marginBottom: 24 }}>
                <div className="tenant-card-title">การแจ้งเตือน Telegram</div>
                <div className="tenant-empty" style={{ padding: 40 }}>
                    <div className="tenant-empty-icon">🔔</div>
                    <div className="tenant-empty-text">ตั้งค่า Telegram ได้ในการจัดการแต่ละวอลเล็ท</div>
                </div>
            </div>

            <div className="tenant-card">
                <div className="tenant-card-title">ข้อมูลระบบ</div>
                <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                        <span style={{ color: "var(--text-muted)", width: 120 }}>Version:</span>
                        <span>1.0.0</span>
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                        <span style={{ color: "var(--text-muted)", width: 120 }}>Panel:</span>
                        <span>Tenant Panel</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
