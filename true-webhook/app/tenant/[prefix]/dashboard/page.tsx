"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "../../../components/Toast";
import { openTenantBalanceStream } from "../../../lib/tenantSse";

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

        let cancelled = false;
        const connections: EventSource[] = [];

        accounts.forEach(account => {
            openTenantBalanceStream(prefix, account.id)
                .then((es) => {
                    if (cancelled) {
                        es.close();
                        return;
                    }

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
                })
                .catch((error) => console.error("SSE connection failed", error));
        });

        return () => {
            cancelled = true;
            connections.forEach(es => es.close());
        };
    }, [accounts, prefix]);

    if (loading) {
        return (
            <div className="flex-center" style={{ padding: 60 }}>
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
        <div>
            <div className="tenant-page-header">
                <h1 className="tenant-page-title">ภาพรวม</h1>
            </div>

            <div 
                className="dashboard-stats-grid" 
                style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                    gap: '16px',
                    marginBottom: '24px'
                }}
            >
                <div className="tenant-card">
                    <div style={{ color: 'var(--theme-text-secondary)', fontSize: '14px', marginBottom: '8px' }}>ยอดรวมทั้งหมด</div>
                    <div style={{ color: 'var(--theme-success)', fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        ฿ {totalBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ color: 'var(--theme-text-muted)', fontSize: '12px', marginTop: '8px' }}>จากทุกวอลเล็ตในระบบ</div>
                </div>
                <div className="tenant-card">
                    <div style={{ color: 'var(--theme-text-secondary)', fontSize: '14px', marginBottom: '8px' }}>วอลเล็ตทั้งหมด</div>
                    <div style={{ color: 'var(--theme-text-primary)', fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {stats?.total || 0}
                    </div>
                    <div style={{ color: 'var(--theme-text-muted)', fontSize: '12px', marginTop: '8px' }}>บัญชีที่ผูกไว้</div>
                </div>
                <div className="tenant-card">
                    <div style={{ color: 'var(--theme-text-secondary)', fontSize: '14px', marginBottom: '8px' }}>ใช้งานอยู่</div>
                    <div style={{ color: 'var(--theme-text-primary)', fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {stats?.active || 0}
                    </div>
                    <div style={{ color: 'var(--theme-text-muted)', fontSize: '12px', marginTop: '8px' }}>วอลเล็ตที่เปิดใช้งาน</div>
                </div>
            </div>

            <div className="tenant-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--theme-text-primary)' }}>Top 3 ยอดเงินสูงสุด</h2>
                    <Link href={`/tenant/${prefix}/wallets`} style={{ color: 'var(--theme-accent)', textDecoration: 'none', fontSize: '14px' }}>
                        ดูทั้งหมด →
                    </Link>
                </div>

                {accounts.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--theme-text-muted)' }}>
                        <div style={{ fontSize: '32px', marginBottom: '16px' }}>💳</div>
                        <div>ยังไม่มีวอลเล็ต คลิก "เพิ่มวอลเล็ต" เพื่อเริ่มต้น</div>
                    </div>
                ) : (
                    <div className="tenant-table-container">
                        <div className="tenant-table-wrapper">
                            <table className="tenant-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '60px' }}>อันดับ</th>
                                        <th>วอลเล็ต</th>
                                        <th>สถานะ</th>
                                        <th style={{ textAlign: 'right' }}>ยอดเงินคงเหลือ</th>
                                        <th>อัปเดตล่าสุด</th>
                                        <th style={{ width: '120px', textAlign: 'right' }}>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {top3Wallets.map((account, index) => (
                                        <tr key={account.id}>
                                            <td>
                                                <span className="badge badge-neutral">#{index + 1}</span>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: '500', color: 'var(--theme-text-primary)' }}>{account.name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--theme-text-secondary)' }}>{account.phoneNumber || "ไม่ระบุเบอร์"}</div>
                                            </td>
                                            <td>
                                                <span className={`badge ${account.isActive ? 'badge-success' : 'badge-error'}`}>
                                                    {account.isActive ? "ใช้งาน" : "ปิด"}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }} className="amount-positive">
                                                ฿ {account.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ color: 'var(--theme-text-secondary)', fontSize: '13px' }}>
                                                {account.checkedAt ? new Date(account.checkedAt).toLocaleString("th-TH") : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        className="tenant-btn tenant-btn-primary tenant-btn-sm"
                                                        onClick={() => handleCheckBalance(account.id)}
                                                        disabled={checkingId === account.id}
                                                    >
                                                        {checkingId === account.id ? (
                                                            <span className="flex-center" style={{ gap: '8px' }}>
                                                                <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} /> เช็ค...
                                                            </span>
                                                        ) : "เช็คยอด"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
