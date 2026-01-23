"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface NetworkInfo {
    id: string;
    name: string;
    prefix: string;
    isActive: boolean;
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

            <div className="tenant-card" style={{ marginBottom: 24 }}>
                <div className="tenant-card-title">ข้อมูลเครือข่าย</div>
                <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                        <span style={{ color: "var(--text-muted)", width: 120 }}>ชื่อ:</span>
                        <span style={{ fontWeight: 600 }}>{network?.name || "-"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                        <span style={{ color: "var(--text-muted)", width: 120 }}>Prefix:</span>
                        <span style={{ fontFamily: "monospace", color: "var(--accent)" }}>{prefix}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                        <span style={{ color: "var(--text-muted)", width: 120 }}>สถานะ:</span>
                        <span style={{
                            color: network?.isActive ? "var(--success)" : "var(--error)",
                            fontWeight: 600
                        }}>
                            {network?.isActive ? "✓ เปิดใช้งาน" : "✕ ปิดใช้งาน"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="tenant-card" style={{ marginBottom: 24 }}>
                <div className="tenant-card-title">การแจ้งเตือน Telegram</div>
                <div className="tenant-empty" style={{ padding: 40 }}>
                    <div className="tenant-empty-icon">🔔</div>
                    <div className="tenant-empty-text">กำลังพัฒนา...</div>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
                        ฟีเจอร์นี้จะเปิดให้ใช้งานเร็วๆ นี้
                    </p>
                </div>
            </div>

            <div className="tenant-card">
                <div className="tenant-card-title">ข้อมูลระบบ</div>
                <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                        <span style={{ color: "var(--text-muted)", width: 120 }}>Version:</span>
                        <span>1.0.0</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                        <span style={{ color: "var(--text-muted)", width: 120 }}>Panel:</span>
                        <span>Tenant Panel</span>
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                        <span style={{ color: "var(--text-muted)", width: 120 }}>URL:</span>
                        <span style={{ fontFamily: "monospace", fontSize: 13 }}>
                            {prefix}.tmw-monitors.com
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
