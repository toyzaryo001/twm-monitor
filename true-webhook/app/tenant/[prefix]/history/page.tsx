"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Account {
    id: string;
    name: string;
    phoneNumber?: string;
}

interface HistoryEntry {
    id: string;
    balance: number;
    change: number;
    mobileNo?: string;
    source?: string;
    checkedAt: string;
}

export default function HistoryPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    useEffect(() => {
        const fetchAccounts = async () => {
            const token = getToken();
            if (!token) return;

            try {
                const res = await fetch(`/api/tenant/${prefix}/accounts`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.ok && data.data.length > 0) {
                    setAccounts(data.data);
                    setSelectedAccount(data.data[0].id);
                }
            } catch (e) {
                console.error("Error fetching accounts", e);
            }
            setLoading(false);
        };

        fetchAccounts();
    }, [prefix]);

    useEffect(() => {
        if (!selectedAccount) return;

        const fetchHistory = async () => {
            setLoadingHistory(true);
            const token = getToken();

            try {
                const res = await fetch(`/api/tenant/${prefix}/accounts/${selectedAccount}/history`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.ok) {
                    setHistory(data.data);
                }
            } catch (e) {
                console.error("Error fetching history", e);
            }
            setLoadingHistory(false);
        };

        fetchHistory();
    }, [selectedAccount, prefix]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
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
                <h1 className="tenant-page-title">ประวัติยอดเงิน</h1>

                {accounts.length > 0 && (
                    <select
                        className="tenant-form-input"
                        style={{ width: "auto", minWidth: 200 }}
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                    >
                        {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                                {acc.name} {acc.phoneNumber ? `(${acc.phoneNumber})` : ""}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="tenant-card">
                {accounts.length === 0 ? (
                    <div className="tenant-empty">
                        <div className="tenant-empty-icon">📜</div>
                        <div className="tenant-empty-text">ยังไม่มีวอลเล็ท กรุณาเพิ่มวอลเล็ทก่อน</div>
                    </div>
                ) : loadingHistory ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                        <div className="spinner" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="tenant-empty">
                        <div className="tenant-empty-icon">📊</div>
                        <div className="tenant-empty-text">ยังไม่มีประวัติยอดเงิน</div>
                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
                            กดปุ่ม "เช็คยอด" ที่หน้า Wallets เพื่อดึงข้อมูล
                        </p>
                    </div>
                ) : (
                    <div style={{ position: "relative" }}>
                        {/* Timeline line */}
                        <div style={{
                            position: "absolute",
                            left: 20,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: "var(--border)",
                        }} />

                        {/* Timeline entries */}
                        {history.map((entry, index) => (
                            <div
                                key={entry.id}
                                style={{
                                    display: "flex",
                                    gap: 20,
                                    padding: "16px 0",
                                    borderBottom: index < history.length - 1 ? "1px solid var(--border)" : "none",
                                }}
                            >
                                {/* Timeline dot */}
                                <div style={{
                                    width: 42,
                                    display: "flex",
                                    justifyContent: "center",
                                    position: "relative",
                                    zIndex: 1,
                                }}>
                                    <div style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: "50%",
                                        background: entry.change > 0
                                            ? "var(--success)"
                                            : entry.change < 0
                                                ? "var(--error)"
                                                : "var(--accent)",
                                        border: "3px solid var(--bg-card)",
                                    }} />
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div>
                                            <div style={{
                                                fontSize: 20,
                                                fontWeight: 700,
                                                color: "var(--text-primary)"
                                            }}>
                                                ฿ {entry.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                            </div>
                                            {entry.change !== 0 && (
                                                <div style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    color: entry.change > 0 ? "var(--success)" : "var(--error)",
                                                    marginTop: 4,
                                                }}>
                                                    {entry.change > 0 ? "+" : ""}
                                                    {entry.change.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                                {formatDate(entry.checkedAt)}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                {formatTime(entry.checkedAt)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
