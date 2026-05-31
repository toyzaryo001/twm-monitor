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

function getWalletErrorMessage(data: any) {
    if (data.error === "WALLET_API_UNREACHABLE") {
        return "ไม่สามารถเชื่อมต่อ Wallet API ได้";
    }

    if (data.error === "WALLET_API_ERROR") {
        const status = data.status ? ` (HTTP ${data.status})` : "";
        const rawDetail = data.detail ? String(data.detail) : "";
        if (rawDetail.includes("No user profile")) {
            return `Wallet API ไม่พบโปรไฟล์ผู้ใช้${status} กรุณาตรวจ Bearer Token หรือผูกวอลเล็ตใหม่`;
        }

        const detail = rawDetail ? `: ${rawDetail.slice(0, 120)}` : "";
        return `Wallet API ตอบกลับผิดพลาด${status}${detail}`;
    }

    return "เกิดข้อผิดพลาด: " + data.error;
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
                    message: getWalletErrorMessage(data)
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
                const statsRes = await fetch(`/api/tenant/${prefix}/stats`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (statsRes.status === 401) {
                    localStorage.removeItem("tenantToken");
                    window.location.href = `/tenant/${prefix}/login`;
                    return;
                }

                const statsData = await statsRes.json();
                if (statsData.ok) {
                    setStats(statsData.data.stats);
                }

                const accountsRes = await fetch(`/api/tenant/${prefix}/accounts`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (accountsRes.status === 401) {
                    localStorage.removeItem("tenantToken");
                    window.location.href = `/tenant/${prefix}/login`;
                    return;
                }

                const accountsData = await accountsRes.json();
                if (accountsData.ok) {
                    setAccounts(accountsData.data);
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

    const totalBalance = Object.values(balances).reduce((sum, b) => sum + (b?.balance || 0), 0);
    const top3Wallets = accounts
        .map(account => ({
            ...account,
            balance: balances[account.id]?.balance || 0,
            checkedAt: balances[account.id]?.checkedAt || null,
        }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 3);

    return (
        <div className="tenant-dashboard">
            <section className="tenant-hero">
                <div>
                    <div className="tenant-hero-kicker">Private Wallet Operations</div>
                    <h1 className="tenant-hero-title">แดชบอร์ด</h1>
                    <p className="tenant-hero-subtitle">
                        ภาพรวมเงินคงเหลือและสถานะวอลเล็ตทั้งหมดในเครือข่าย พร้อมลัดไปจัดการวอลเล็ตและประวัติรายการได้ทันที
                    </p>
                    <div className="tenant-hero-meta" style={{ marginTop: 20 }}>
                        <span className="tenant-pill">{stats?.total || 0} wallets</span>
                        <span className="tenant-pill">{stats?.active || 0} active</span>
                        <span className="tenant-pill">Realtime monitor</span>
                    </div>
                </div>
                <div className="tenant-hero-panel">
                    <div className="balance-card-label">ยอดรวมทั้งหมด</div>
                    <div className="tenant-hero-balance">
                        ฿ {totalBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="balance-card-name">จากทุกวอลเล็ตในระบบ</div>
                </div>
            </section>

            <div className="balance-grid">
                <div className="balance-card">
                    <div className="balance-card-label">ยอดรวมทั้งหมด</div>
                    <div className="balance-card-value" style={{ color: "var(--tenant-success)" }}>
                        ฿ {totalBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="balance-card-name">จากทุกวอลเล็ต</div>
                </div>
                <div className="balance-card">
                    <div className="balance-card-label">วอลเล็ตทั้งหมด</div>
                    <div className="balance-card-value" style={{ color: "var(--tenant-primary)" }}>{stats?.total || 0}</div>
                    <div className="balance-card-name">บัญชีที่ผูกไว้</div>
                </div>
                <div className="balance-card">
                    <div className="balance-card-label">ใช้งานอยู่</div>
                    <div className="balance-card-value">{stats?.active || 0}</div>
                    <div className="balance-card-name">วอลเล็ตที่เปิดใช้งาน</div>
                </div>
            </div>

            <div className="tenant-card">
                <div className="tenant-section-head">
                    <h2 className="tenant-section-title">Top 3 ยอดเงินสูงสุด</h2>
                    <Link href={`/tenant/${prefix}/wallets`} className="tenant-section-link">
                        ดูทั้งหมด →
                    </Link>
                </div>

                {accounts.length === 0 ? (
                    <div className="tenant-empty">
                        <div className="tenant-empty-icon">💳</div>
                        <div className="tenant-empty-text">ยังไม่มีวอลเล็ต คลิก "เพิ่มวอลเล็ต" เพื่อเริ่มต้น</div>
                    </div>
                ) : (
                    <div className="dashboard-wallet-grid">
                        {top3Wallets.map((account, index) => (
                            <div
                                key={account.id}
                                className="dashboard-wallet-card"
                                style={{ borderColor: index === 0 ? "rgba(244, 223, 154, 0.62)" : undefined }}
                            >
                                <div className="rank-badge">#{index + 1}</div>

                                <div className="wallet-card-header">
                                    <div className="wallet-icon">◆</div>
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
                                        ฿ {account.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                    </div>
                                    {account.checkedAt && (
                                        <div style={{ fontSize: 11, color: "var(--tenant-text-muted)", marginTop: 4 }}>
                                            อัปเดต: {new Date(account.checkedAt).toLocaleString("th-TH")}
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
                                        {checkingId === account.id ? "กำลังเช็ค..." : "เช็คยอด"}
                                    </button>
                                    <Link href={`/tenant/${prefix}/history?wallet=${account.id}`} className="tenant-btn tenant-btn-secondary">
                                        ประวัติ
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="tenant-card">
                <div className="tenant-section-head">
                    <h2 className="tenant-section-title">การดำเนินการ</h2>
                </div>
                <div className="tenant-quick-actions">
                    <Link href={`/tenant/${prefix}/wallets`} className="tenant-btn tenant-btn-secondary">
                        จัดการวอลเล็ต
                    </Link>
                    <Link href={`/tenant/${prefix}/history`} className="tenant-btn tenant-btn-secondary">
                        ดูประวัติยอด
                    </Link>
                    <Link href={`/tenant/${prefix}/settings`} className="tenant-btn tenant-btn-secondary">
                        ตั้งค่า
                    </Link>
                </div>
            </div>
        </div>
    );
}
