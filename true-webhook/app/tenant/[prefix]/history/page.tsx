"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
    type?: string;
    amount?: number;
    fee?: number;
    direction?: string;
    sender?: string;
    recipient?: string;
    status?: string;
}

type Tab = "all" | "deposit" | "withdraw" | "fee";

type DateRange = "today" | "yesterday" | "3d" | "7d" | "15d" | "30d" | "all";

export default function HistoryPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // Filters
    const [activeTab, setActiveTab] = useState<Tab>("all");
    const [dateFilter, setDateFilter] = useState<DateRange>("today");

    const eventSourceRef = useRef<EventSource | null>(null);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    const fetchHistory = useCallback(async (showLoading = false) => {
        if (!selectedAccount) return;

        if (showLoading) setLoadingHistory(true);
        const token = getToken();

        try {
            // Fetch more items to support client-side filtering
            const limit = 200;
            const res = await fetch(`/api/tenant/${prefix}/accounts/${selectedAccount}/history?limit=${limit}`, {
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
    }, [selectedAccount, prefix]);

    // Fetch accounts
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

    // Fetch history
    useEffect(() => {
        if (selectedAccount) {
            fetchHistory(true);
        }
    }, [selectedAccount, fetchHistory]);

    // SSE
    useEffect(() => {
        if (!selectedAccount) return;
        if (eventSourceRef.current) eventSourceRef.current.close();

        const eventSource = new EventSource(`/api/sse/balance/${selectedAccount}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => setIsConnected(true);
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "update") fetchHistory(false);
            } catch (e) { }
        };
        eventSource.onerror = () => setIsConnected(false);

        return () => {
            eventSource.close();
            setIsConnected(false);
        };
    }, [selectedAccount, fetchHistory]);

    // Helpers
    const isFee = (entry: HistoryEntry) => {
        // Identify fee transaction: 
        // 1. Explicitly named "Fee" in recipient
        // 2. Or Amount matches Fee (pure fee deduction)
        // 3. Or P2P Fee Collection
        if (entry.recipient && (entry.recipient.includes("Fee") || entry.recipient.includes("P2P Fee"))) return true;
        if (entry.fee && entry.fee > 0 && entry.amount === entry.fee) return true;
        return false;
    };

    const filterDate = (entry: HistoryEntry) => {
        if (dateFilter === "all") return true;

        const txDate = new Date(entry.checkedAt);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const entryDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());

        if (dateFilter === "today") {
            return entryDay.getTime() === today.getTime();
        }

        if (dateFilter === "yesterday") {
            const yest = new Date(today);
            yest.setDate(yest.getDate() - 1);
            return entryDay.getTime() === yest.getTime();
        }

        const diffTime = Math.abs(today.getTime() - entryDay.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (dateFilter === "3d") return diffDays <= 3;
        if (dateFilter === "7d") return diffDays <= 7;
        if (dateFilter === "15d") return diffDays <= 15;
        if (dateFilter === "30d") return diffDays <= 30;

        return true;
    };

    const getFilteredHistory = () => {
        return history.filter(entry => {
            // 1. Date Filter (Apply to ALL tabs or just Fee? User asked for Fee, but useful for all)
            if (!filterDate(entry)) return false;

            // 2. Tab Filter
            if (activeTab === "all") return true; // Show everything in All? Or maybe exclude fees? Let's show all.
            if (activeTab === "deposit") return entry.change > 0;
            if (activeTab === "fee") return isFee(entry);
            if (activeTab === "withdraw") return entry.change < 0 && !isFee(entry);

            return true;
        });
    };

    const filteredHistory = getFilteredHistory();
    const totalAmount = filteredHistory.reduce((sum, entry) => sum + Math.abs(entry.type === 'transaction' && entry.amount ? entry.amount : entry.change), 0);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    if (loading) return <div className="flex-center p-60"><div className="spinner" /></div>;

    return (
        <div>
            <div className="tenant-page-header">
                <h1 className="tenant-page-title">ประวัติยอดเงิน</h1>
                <div className="flex-center gap-16">
                    {/* Live Status */}
                    <div className="flex-center gap-6">
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: isConnected ? "#22c55e" : "#ef4444", animation: isConnected ? "pulse 2s infinite" : "none" }} />
                        <span style={{ fontSize: 12, color: isConnected ? "#22c55e" : "#ef4444" }}>{isConnected ? "LIVE" : "OFFLINE"}</span>
                    </div>
                    {/* Account Select */}
                    {accounts.length > 0 && (
                        <select className="tenant-form-input w-auto min-w-200" value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>{acc.name} {acc.phoneNumber ? `(${acc.phoneNumber})` : ""}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                .tab-btn { padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-secondary); transition: all 0.2s; }
                .tab-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
                .date-btn { padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-muted); }
                .date-btn.active { background: var(--text-primary); color: var(--bg-card); border-color: var(--text-primary); }
                .summary-card { padding: 16px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            `}</style>

            <div className="tenant-card">
                {/* Tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
                    <button className={`tab-btn ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>ทั้งหมด</button>
                    <button className={`tab-btn ${activeTab === "deposit" ? "active" : ""}`} onClick={() => setActiveTab("deposit")}>ฝากเงิน</button>
                    <button className={`tab-btn ${activeTab === "withdraw" ? "active" : ""}`} onClick={() => setActiveTab("withdraw")}>ถอนเงิน</button>
                    <button className={`tab-btn ${activeTab === "fee" ? "active" : ""}`} onClick={() => setActiveTab("fee")}>ค่าธรรมเนียม</button>
                </div>

                {/* Date Filters (Always visible for better UX, or just fee? User asked for fee, but helpful especially for All/Deposit too) */}
                <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)", marginRight: 8 }}>ช่วงเวลา:</span>
                    <button className={`date-btn ${dateFilter === "today" ? "active" : ""}`} onClick={() => setDateFilter("today")}>วันนี้</button>
                    <button className={`date-btn ${dateFilter === "yesterday" ? "active" : ""}`} onClick={() => setDateFilter("yesterday")}>เมื่อวาน</button>
                    <button className={`date-btn ${dateFilter === "3d" ? "active" : ""}`} onClick={() => setDateFilter("3d")}>3 วัน</button>
                    <button className={`date-btn ${dateFilter === "7d" ? "active" : ""}`} onClick={() => setDateFilter("7d")}>7 วัน</button>
                    <button className={`date-btn ${dateFilter === "15d" ? "active" : ""}`} onClick={() => setDateFilter("15d")}>15 วัน</button>
                    <button className={`date-btn ${dateFilter === "30d" ? "active" : ""}`} onClick={() => setDateFilter("30d")}>1 เดือน</button>
                    <button className={`date-btn ${dateFilter === "all" ? "active" : ""}`} onClick={() => setDateFilter("all")}>ทั้งหมด</button>
                </div>

                {/* Summary Box */}
                <div className="summary-card">
                    <div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>ยอดรวม ({activeTab === 'fee' ? 'ค่าธรรมเนียม' : activeTab === 'deposit' ? 'เงินเข้า' : activeTab === 'withdraw' ? 'เงินออก' : 'การเคลื่อนไหว'})</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                            ฿ {totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {filteredHistory.length} รายการ
                    </div>
                </div>

                {loadingHistory ? (
                    <div className="flex-center p-40"><div className="spinner" /></div>
                ) : filteredHistory.length === 0 ? (
                    <div className="tenant-empty">
                        <div className="tenant-empty-icon">📅</div>
                        <div className="tenant-empty-text">ไม่พบรายการในช่วงเวลานี้</div>
                    </div>
                ) : (
                    <div style={{ position: "relative" }}>
                        <div style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 2, background: "var(--border)" }} />
                        {filteredHistory.map((entry, index) => (
                            <div key={entry.id} style={{ display: "flex", gap: 20, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ width: 42, display: "flex", justifyContent: "center", position: "relative", zIndex: 1 }}>
                                    <div style={{
                                        width: 14, height: 14, borderRadius: "50%",
                                        background: isFee(entry) ? "var(--text-muted)" : (entry.change > 0 ? "var(--success)" : "var(--error)"),
                                        border: "3px solid var(--bg-card)"
                                    }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                                                {entry.type === 'transaction'
                                                    ? `฿ ${(entry.amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                                                    : `฿ ${entry.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                                                }
                                            </div>
                                            <div style={{ marginTop: 4 }}>
                                                {isFee(entry) ? (
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
                                                        หักค่าธรรมเนียม
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: entry.change > 0 ? "var(--success)" : "var(--error)", display: "flex", alignItems: "center", gap: 8 }}>
                                                        <span>{entry.change > 0 ? "รับเงินจาก" : "โอนเงินไป"}</span>
                                                        <span style={{ color: "var(--text-primary)" }}>
                                                            {entry.change > 0
                                                                ? (entry.sender || "Unknown")
                                                                : (entry.recipient || "Unknown")
                                                            }
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{formatDate(entry.checkedAt)}</div>
                                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatTime(entry.checkedAt)}</div>
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
