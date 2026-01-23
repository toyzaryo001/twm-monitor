"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Account {
    id: string;
    name: string;
    phoneNumber?: string;
    isActive: boolean;
}

interface BalanceData {
    balance: number;
    checkedAt: string;
}

interface Stats {
    total: number;
    active: number;
}

export default function TenantDashboard() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [balances, setBalances] = useState<Record<string, BalanceData | null>>({});
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    const fetchCachedBalance = useCallback(async (accountId: string) => {
        const token = getToken();
        try {
            const res = await fetch(`/api/tenant/${prefix}/accounts/${accountId}/balance`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.ok && data.data) {
                setBalances(prev => ({ ...prev, [accountId]: data.data }));
            }
        } catch (e) {
            console.error("Error fetching cached balance", e);
        }
    }, [prefix]);

    const handleCheckBalance = async (accountId: string) => {
        setCheckingId(accountId);
        const token = getToken();

        try {
            const res = await fetch(`/api/tenant/${prefix}/accounts/${accountId}/balance`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (data.ok) {
                setBalances(prev => ({ ...prev, [accountId]: data.data }));
            } else {
                alert(data.error === "WALLET_API_UNREACHABLE"
                    ? "ไม่สามารถเชื่อมต่อ Wallet API ได้"
                    : data.error === "WALLET_API_ERROR"
                        ? "Wallet API ตอบกลับผิดพลาด"
                        : "เกิดข้อผิดพลาด: " + data.error);
            }
        } catch (e) {
            alert("เกิดข้อผิดพลาดในการเช็คยอด");
        }
        setCheckingId(null);
    };

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
                    // Fetch cached balances
                    for (const account of accountsData.data) {
                        fetchCachedBalance(account.id);
                    }
                }
            } catch (e) {
                console.error("Error fetching data", e);
            }
            setLoading(false);
        };

        fetchData();
    }, [prefix, fetchCachedBalance]);

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <div className="spinner" />
            </div>
        );
    }

    // Calculate total balance
    const totalBalance = Object.values(balances).reduce((sum, b) => sum + (b?.balance || 0), 0);

    return (
        <div>
            {/* Page Header */}
            <div className="tenant-page-header">
                <h1 className="tenant-page-title">แดชบอร์ด</h1>
            </div>

            {/* Stats Cards */}
            <div className="balance-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="balance-card">
                    <div className="balance-card-label">ยอดรวมทั้งหมด</div>
                    <div className="balance-card-value" style={{ color: "var(--success)" }}>
                        ฿ {totalBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="balance-card-name">จากทุกวอลเล็ท</div>
                </div>
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
                    <Link href="/wallets" style={{ color: "var(--accent)", fontSize: 13, textDecoration: "none" }}>
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
                                    <div className="wallet-balance-value">
                                        {balances[account.id]
                                            ? `฿ ${balances[account.id]!.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                                            : "฿ ---.--"}
                                    </div>
                                    {balances[account.id] && (
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                            อัพเดท: {new Date(balances[account.id]!.checkedAt).toLocaleString("th-TH")}
                                        </div>
                                    )}
                                </div>

                                <div className="wallet-actions">
                                    <button
                                        className="tenant-btn tenant-btn-primary"
                                        style={{ flex: 1 }}
                                        onClick={() => handleCheckBalance(account.id)}
                                        disabled={checkingId === account.id}
                                    >
                                        {checkingId === account.id ? "⏳ กำลังเช็ค..." : "🔄 เช็คยอด"}
                                    </button>
                                    <Link href={`/history?wallet=${account.id}`} className="tenant-btn tenant-btn-secondary">
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
                        <Link href="/wallets" className="tenant-btn tenant-btn-secondary">
                            💳 จัดการวอลเล็ท
                        </Link>
                        <Link href="/history" className="tenant-btn tenant-btn-secondary">
                            📜 ดูประวัติยอด
                        </Link>
                        <Link href="/settings" className="tenant-btn tenant-btn-secondary">
                            ⚙️ ตั้งค่า
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
