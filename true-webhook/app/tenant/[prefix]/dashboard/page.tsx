"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "../../../components/Toast";

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
    const { showToast } = useToast();
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
                showToast({
                    type: "error",
                    title: "เกิดข้อผิดพลาด",
                    message: data.error === "WALLET_API_UNREACHABLE"
                        ? "ไม่สามารถเชื่อมต่อ Wallet API ได้"
                        : data.error === "WALLET_API_ERROR"
                            ? "Wallet API ตอบกลับผิดพลาด"
                            : "เกิดข้อผิดพลาด: " + data.error
                });
            }
        } catch (e) {
            showToast({ type: "error", title: "ล้มเหลว", message: "เกิดข้อผิดพลาดในการเช็คยอด" });
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

                // Check for 401 and redirect to login
                if (statsRes.status === 401) {
                    localStorage.removeItem("tenantToken");
                    window.location.href = `/tenant/${prefix}/login`;
                    return;
                }

                const statsData = await statsRes.json();
                if (statsData.ok) {
                    setStats(statsData.data.stats);
                }

                // Fetch accounts
                const accountsRes = await fetch(`/api/tenant/${prefix}/accounts`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                // Check for 401 and redirect to login
                if (accountsRes.status === 401) {
                    localStorage.removeItem("tenantToken");
                    window.location.href = `/tenant/${prefix}/login`;
                    return;
                }

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

    // Real-time balance updates via SSE
    useEffect(() => {
        if (accounts.length === 0) return;

        const connections: EventSource[] = [];

        accounts.forEach(account => {
            const es = new EventSource(`/api/sse/balance/${account.id}`);

            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "initial" || data.type === "update") {
                        setBalances(prev => ({
                            ...prev,
                            [account.id]: {
                                balance: data.balance,
                                checkedAt: data.checkedAt
                            }
                        }));
                    }
                } catch (e) {
                    console.error("SSE Parse Error", e);
                }
            };

            connections.push(es);
        });

        return () => {
            connections.forEach(es => es.close());
        };
    }, [accounts]);

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <div className="spinner" />
            </div>
        );
    }

    // Calculate total balance
    const totalBalance = Object.values(balances).reduce((sum, b) => sum + (b?.balance || 0), 0);

    // Get top 3 wallets by balance
    const top3Wallets = accounts
        .map(account => ({
            ...account,
            balance: balances[account.id]?.balance || 0,
            checkedAt: balances[account.id]?.checkedAt || null,
        }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 3);

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

            {/* Top 3 Wallet Cards */}
            <div className="tenant-card">
                <div className="tenant-card-header">
                    <div className="tenant-card-title">🏆 Top 3 ยอดเงินสูงสุด</div>
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
                    <div className="dashboard-wallet-grid">
                        {top3Wallets.map((account, index) => (
                            <div key={account.id} className="dashboard-wallet-card" style={{
                                border: index === 0 ? "2px solid var(--success)" : undefined,
                                position: "relative"
                            }}>
                                {/* Rank badge */}
                                <div style={{
                                    position: "absolute",
                                    top: -10,
                                    left: -10,
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    background: index === 0 ? "#ffd700" : index === 1 ? "#c0c0c0" : "#cd7f32",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 700,
                                    color: index === 0 ? "#000" : "#fff",
                                    fontSize: 14,
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                                }}>
                                    #{index + 1}
                                </div>

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
                                    <div className="wallet-balance-value" style={{
                                        color: index === 0 ? "var(--success)" : undefined,
                                        fontSize: index === 0 ? "2rem" : undefined
                                    }}>
                                        ฿ {account.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                    </div>
                                    {account.checkedAt && (
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                            อัพเดท: {new Date(account.checkedAt).toLocaleString("th-TH")}
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
