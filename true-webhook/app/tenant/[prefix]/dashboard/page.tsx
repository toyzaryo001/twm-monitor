"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Account {
    id: string;
    name: string;
    phoneNumber?: string;
    isActive: boolean;
}

interface Stats {
    total: number;
    active: number;
}

export default function TenantDashboard() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    useEffect(() => {
        const fetchData = async () => {
            const token = getToken();
            if (!token) return;

            try {
                // Fetch stats
                const statsRes = await fetch(`/api/tenant/${prefix}/stats`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const statsData = await statsRes.json();
                if (statsData.ok) {
                    setStats(statsData.data.stats);
                }

                // Fetch accounts
                const accountsRes = await fetch(`/api/tenant/${prefix}/accounts`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const accountsData = await accountsRes.json();
                if (accountsData.ok) {
                    setAccounts(accountsData.data);
                }
            } catch (e) {
                console.error("Error fetching data", e);
            }
            setLoading(false);
        };

        fetchData();
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
            {/* Page Header */}
            <div className="tenant-page-header">
                <h1 className="tenant-page-title">แดชบอร์ด</h1>
                <Link href={`/tenant/${prefix}/wallets`} className="tenant-btn tenant-btn-primary">
                    ➕ เพิ่มวอลเล็ท
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="balance-grid">
                <div className="balance-card">
                    <div className="balance-card-label">วอลเล็ททั้งหมด</div>
                    <div className="balance-card-value" style={{ color: "var(--accent)" }}>{stats?.total || 0}</div>
                    <div className="balance-card-name">บัญชีที่ผูกไว้</div>
                </div>
                <div className="balance-card">
                    <div className="balance-card-label">ใช้งานอยู่</div>
                    <div className="balance-card-value">{stats?.active || 0}</div>
                    <div className="balance-card-name">วอลเล็ทที่เปิดใช้งาน</div>
                </div>
            </div>

            {/* Wallet Cards */}
            <div className="tenant-card">
                <div className="tenant-card-header">
                    <div className="tenant-card-title">วอลเล็ทของคุณ</div>
                    <Link href={`/tenant/${prefix}/wallets`} style={{ color: "var(--accent)", fontSize: 13, textDecoration: "none" }}>
                        ดูทั้งหมด →
                    </Link>
                </div>

                {accounts.length === 0 ? (
                    <div className="tenant-empty">
                        <div className="tenant-empty-icon">💳</div>
                        <div className="tenant-empty-text">ยังไม่มีวอลเล็ท คลิก "เพิ่มวอลเล็ท" เพื่อเริ่มต้น</div>
                    </div>
                ) : (
                    <div className="wallet-grid">
                        {accounts.slice(0, 4).map((account) => (
                            <div key={account.id} className="wallet-card">
                                <div className="wallet-card-header">
                                    <div className="wallet-icon">🔶</div>
                                    <div className="wallet-info">
                                        <div className="wallet-name">{account.name}</div>
                                        <div className="wallet-phone">{account.phoneNumber || "ไม่ระบุเบอร์"}</div>
                                    </div>
                                    <span className={`wallet-status ${account.isActive ? "active" : "inactive"}`}>
                                        {account.isActive ? "ใช้งาน" : "ปิด"}
                                    </span>
                                </div>

                                <div className="wallet-balance">
                                    <div className="wallet-balance-label">ยอดเงินคงเหลือ</div>
                                    <div className="wallet-balance-value">฿ ---.--</div>
                                </div>

                                <div className="wallet-actions">
                                    <button className="tenant-btn tenant-btn-primary" style={{ flex: 1 }}>
                                        🔄 เช็คยอด
                                    </button>
                                    <Link href={`/tenant/${prefix}/history?wallet=${account.id}`} className="tenant-btn tenant-btn-secondary">
                                        📜 ประวัติ
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div style={{ marginTop: 24 }}>
                <div className="tenant-card">
                    <div className="tenant-card-title">การดำเนินการ</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
                        <Link href={`/tenant/${prefix}/wallets`} className="tenant-btn tenant-btn-secondary">
                            💳 จัดการวอลเล็ท
                        </Link>
                        <Link href={`/tenant/${prefix}/history`} className="tenant-btn tenant-btn-secondary">
                            📜 ดูประวัติยอด
                        </Link>
                        <Link href={`/tenant/${prefix}/settings`} className="tenant-btn tenant-btn-secondary">
                            ⚙️ ตั้งค่า
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
