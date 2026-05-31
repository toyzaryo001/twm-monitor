"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { openTenantBalanceStream } from "../../../lib/tenantSse";

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
    type?: string; // 'transaction' or 'snapshot'
    amount?: number;
    fee?: number;
    direction?: string;
    sender?: string;
    recipient?: string;
    status?: string;
    accountName?: string;
}

type Tab = "all" | "deposit" | "withdraw" | "fee";

type DateRange = "today" | "yesterday" | "3d" | "7d" | "15d" | "30d" | "all" | "custom";

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
    const [activeTab, setActiveTab] = useState<Tab>("deposit");
    const [dateFilter, setDateFilter] = useState<DateRange>("today");
    const [limit, setLimit] = useState<number>(20);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalItems, setTotalItems] = useState<number>(0);

    // Custom date range
    const [customStartDate, setCustomStartDate] = useState<string>("");
    const [customEndDate, setCustomEndDate] = useState<string>("");

    const eventSourceRef = useRef<EventSource | null>(null);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    const getDateRangeParams = (filter: DateRange) => {
        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        if (filter === "today") {
            return `&from=${startOfDay.toISOString()}&to=${endOfDay.toISOString()}`;
        }
        if (filter === "yesterday") {
            const startYest = new Date(startOfDay);
            startYest.setDate(startYest.getDate() - 1);
            const endYest = new Date(startYest);
            endYest.setHours(23, 59, 59, 999);
            return `&from=${startYest.toISOString()}&to=${endYest.toISOString()}`;
        }
        if (filter === "3d") {
            const start = new Date(startOfDay);
            start.setDate(start.getDate() - 3);
            return `&from=${start.toISOString()}&to=${endOfDay.toISOString()}`;
        }
        if (filter === "7d") {
            const start = new Date(startOfDay);
            start.setDate(start.getDate() - 7);
            return `&from=${start.toISOString()}&to=${endOfDay.toISOString()}`;
        }
        if (filter === "15d") {
            const start = new Date(startOfDay);
            start.setDate(start.getDate() - 15);
            return `&from=${start.toISOString()}&to=${endOfDay.toISOString()}`;
        }
        if (filter === "30d") {
            const start = new Date(startOfDay);
            start.setDate(start.getDate() - 30);
            return `&from=${start.toISOString()}&to=${endOfDay.toISOString()}`;
        }
        if (filter === "custom" && customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            return `&from=${start.toISOString()}&to=${end.toISOString()}`;
        }
        return ""; // All
    };

    interface FeeSummary {
        accountId: string;
        accountName: string;
        phoneNumber?: string;
        totalFee: number;
        firstActiveAt: string | null;
    }

    const [feeSummary, setFeeSummary] = useState<FeeSummary[]>([]);

    const [viewMode, setViewMode] = useState<"summary" | "detail">("summary");

    const fetchHistory = useCallback(async (showLoading = false) => {
        if (!selectedAccount) return;

        if (showLoading) setLoadingHistory(true);
        const token = getToken();

        try {
            const dateParams = getDateRangeParams(dateFilter);

            // IF FEE TAB & SUMMARY MODE -> Fetch Summary
            if (activeTab === "fee" && viewMode === "summary") {
                const url = `/api/tenant/${prefix}/accounts/fee-summary?${dateParams.replace('&', '')}`; // remove leading & if any
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

                // Check for 401 and redirect to login
                if (res.status === 401) {
                    localStorage.removeItem("tenantToken");
                    window.location.href = `/tenant/${prefix}/login`;
                    return;
                }

                const data = await res.json();
                if (data.ok) {
                    setFeeSummary(data.data);
                    // Reset pagination for consistency (though not used)
                    setTotalPages(1);
                    setTotalItems(data.data.length);
                }
            } else {
                // Existing Logic for Deposit/Withdraw OR Fee Detail
                const filterParam = `&filter=${activeTab}`;
                let url = "";
                if (selectedAccount === "all") {
                    url = `/api/tenant/${prefix}/accounts/all-history?limit=${limit}&page=${page}${dateParams}${filterParam}`;
                } else {
                    url = `/api/tenant/${prefix}/accounts/${selectedAccount}/history?limit=${limit}&page=${page}${dateParams}${filterParam}`;
                }

                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

                // Check for 401 and redirect to login
                if (res.status === 401) {
                    localStorage.removeItem("tenantToken");
                    window.location.href = `/tenant/${prefix}/login`;
                    return;
                }

                const data = await res.json();
                if (data.ok) {
                    setHistory(data.data);
                    if (data.pagination) {
                        setTotalPages(data.pagination.totalPages);
                        setTotalItems(data.pagination.total);
                    }
                }
            }
        } catch (e) {
            console.error("Error fetching history", e);
        }
        setLoadingHistory(false);
    }, [selectedAccount, prefix, limit, page, dateFilter, activeTab, viewMode]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [selectedAccount, limit, dateFilter, activeTab, viewMode]);

    // Reset viewMode when tab changes
    useEffect(() => {
        if (activeTab !== 'fee') {
            setViewMode('summary');
        } else {
            // If switching TO fee tab, reset to summary
            setViewMode('summary');
            setSelectedAccount('all'); // Reset account selection for summary view
        }
    }, [activeTab]);

    // Fetch accounts
    useEffect(() => {
        const fetchAccounts = async () => {
            // ... existing code ...
            const token = getToken();
            if (!token) return;

            try {
                const res = await fetch(`/api/tenant/${prefix}/accounts`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.ok && data.data.length > 0) {
                    setAccounts(data.data);
                    if (!selectedAccount) {
                        setSelectedAccount(data.data[0].id);
                    }
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
        if (!selectedAccount || selectedAccount === "all") {
            if (eventSourceRef.current) eventSourceRef.current.close();
            setIsConnected(false);
            return;
        }

        if (eventSourceRef.current) eventSourceRef.current.close();

        let cancelled = false;

        const connect = async () => {
            try {
                const eventSource = await openTenantBalanceStream(prefix, selectedAccount);
                if (cancelled) {
                    eventSource.close();
                    return;
                }

                eventSourceRef.current = eventSource;
                eventSource.onopen = () => setIsConnected(true);
                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === "update") fetchHistory(false);
                    } catch (e) { }
                };
                eventSource.onerror = () => setIsConnected(false);
            } catch (error) {
                if (!cancelled) {
                    console.error("SSE connection failed", error);
                    setIsConnected(false);
                }
            }
        };

        connect();

        return () => {
            cancelled = true;
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            setIsConnected(false);
        };
    }, [selectedAccount, fetchHistory, prefix]);

    // Helpers
    const isFee = (entry: HistoryEntry) => {
        if (entry.recipient && (entry.recipient.includes("Fee") || entry.recipient.includes("P2P Fee"))) return true;
        if (entry.fee && entry.fee > 0 && entry.amount === entry.fee) return true;
        if (entry.recipient === "System Fee") return true;
        return false;
    };

    // Use raw history as it is already filtered by server
    const filteredHistory = history;

    // Calculate total amount for display
    const totalAmount = activeTab === 'fee' && viewMode === 'summary'
        ? feeSummary.reduce((sum, item) => sum + item.totalFee, 0)
        : filteredHistory.reduce((sum, entry) => {
            const val = entry.type === 'transaction' && entry.amount ? entry.amount : Math.abs(entry.change);
            return sum + val;
        }, 0);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return `${d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
    };

    if (loading) return <div className="flex-center p-60"><div className="spinner" /></div>;

    return (
        <div>
            <div className="tenant-page-header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Back Button for Detail Mode */}
                    {activeTab === 'fee' && viewMode === 'detail' && (
                        <button
                            onClick={() => {
                                setViewMode('summary');
                                setSelectedAccount('all');
                            }}
                            className="tenant-btn-secondary"
                            style={{ padding: "4px 8px", fontSize: 18, border: "none", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}
                        >
                            ←
                        </button>
                    )}
                    <h1 className="tenant-page-title">
                        {activeTab === 'fee' && viewMode === 'detail'
                            ? `ประวัติ: ${accounts.find(a => a.id === selectedAccount)?.name || 'รายบัญชี'}`
                            : "ประวัติยอดเงิน"}
                    </h1>
                </div>

                <div className="flex-center gap-16">
                    {/* Live Status - Hide on Fee Tab (All modes) */}
                    {activeTab !== 'fee' && selectedAccount !== 'all' && (
                        <div className="flex-center gap-6">
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isConnected ? "#22c55e" : "#ef4444", animation: isConnected ? "pulse 2s infinite" : "none" }} />
                            <span style={{ fontSize: 12, color: isConnected ? "#22c55e" : "#ef4444" }}>{isConnected ? "LIVE" : "OFFLINE"}</span>
                        </div>
                    )}

                    {/* Account Select - Hide on Fee Tab (All modes) */}
                    {activeTab !== 'fee' && accounts.length > 0 && (
                        <select className="tenant-form-input w-auto min-w-200" value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                            <option value="all">ทั้งหมด (รวมทุกวอลเล็ท)</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>{acc.name} {acc.phoneNumber ? `(${acc.phoneNumber})` : ""}</option>
                            ))}
                        </select>
                    )}

                    {/* Limit Select (Only for non-fee tabs OR fee detail mode) */}
                    {(activeTab !== 'fee' || viewMode === 'detail') && (
                        <select
                            className="tenant-form-input w-auto"
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            style={{ cursor: "pointer" }}
                        >
                            <option value={20}>20 รายการ</option>
                            <option value={50}>50 รายการ</option>
                            <option value={100}>100 รายการ</option>
                            <option value={300}>300 รายการ</option>
                            <option value={500}>500 รายการ</option>
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
                .history-table { width: 100%; border-collapse: collapse; font-size: 14px; }
                .history-table th { text-align: left; padding: 12px; color: var(--text-muted); font-weight: 500; border-bottom: 1px solid var(--border); }
                .history-table td { padding: 12px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
                .history-table tr:last-child td { border-bottom: none; }
            `}</style>

            <div className="tenant-card">
                {/* Tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
                    <button className={`tab-btn ${activeTab === "deposit" ? "active" : ""}`} onClick={() => setActiveTab("deposit")}>ฝากเงิน</button>
                    <button className={`tab-btn ${activeTab === "withdraw" ? "active" : ""}`} onClick={() => setActiveTab("withdraw")}>ถอนเงิน</button>
                    <button className={`tab-btn ${activeTab === "fee" ? "active" : ""}`} onClick={() => setActiveTab("fee")}>ค่าธรรมเนียม</button>
                </div>

                {/* Date Filters */}
                <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)", marginRight: 8 }}>ช่วงเวลา:</span>
                    <button className={`date-btn ${dateFilter === "today" ? "active" : ""}`} onClick={() => setDateFilter("today")}>วันนี้</button>
                    <button className={`date-btn ${dateFilter === "yesterday" ? "active" : ""}`} onClick={() => setDateFilter("yesterday")}>เมื่อวาน</button>
                    <button className={`date-btn ${dateFilter === "3d" ? "active" : ""}`} onClick={() => setDateFilter("3d")}>3 วัน</button>
                    <button className={`date-btn ${dateFilter === "7d" ? "active" : ""}`} onClick={() => setDateFilter("7d")}>7 วัน</button>
                    <button className={`date-btn ${dateFilter === "15d" ? "active" : ""}`} onClick={() => setDateFilter("15d")}>15 วัน</button>
                    <button className={`date-btn ${dateFilter === "30d" ? "active" : ""}`} onClick={() => setDateFilter("30d")}>1 เดือน</button>
                    <button className={`date-btn ${dateFilter === "all" ? "active" : ""}`} onClick={() => setDateFilter("all")}>ทั้งหมด</button>
                    <button className={`date-btn ${dateFilter === "custom" ? "active" : ""}`} onClick={() => setDateFilter("custom")}>กำหนดเอง</button>
                </div>

                {/* Custom Date Range Picker */}
                {dateFilter === "custom" && (
                    <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
                        <label style={{ fontSize: 13, color: "var(--text-muted)" }}>จาก:</label>
                        <input
                            type="date"
                            className="tenant-form-input"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            style={{ width: "auto", padding: "6px 12px" }}
                        />
                        <label style={{ fontSize: 13, color: "var(--text-muted)" }}>ถึง:</label>
                        <input
                            type="date"
                            className="tenant-form-input"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            style={{ width: "auto", padding: "6px 12px" }}
                        />
                        <button
                            className="tenant-btn tenant-btn-primary"
                            style={{ padding: "6px 16px", fontSize: 13 }}
                            onClick={() => fetchHistory(true)}
                            disabled={!customStartDate || !customEndDate}
                        >
                            🔍 ค้นหา
                        </button>
                    </div>
                )}

                {/* Summary Box */}
                <div className="summary-card">
                    <div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>ยอดรวม ({activeTab === 'fee' ? 'ค่าธรรมเนียม' : activeTab === 'deposit' ? 'เงินเข้า' : activeTab === 'withdraw' ? 'เงินออก' : 'การเคลื่อนไหว'})</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                            ฿ {totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {activeTab === 'fee'
                            ? `${feeSummary.length} บัญชี`
                            : `${filteredHistory.length} รายการ (จากทั้งหมด ${totalItems})`
                        }
                    </div>
                </div>

                {loadingHistory ? (
                    <div className="flex-center p-40"><div className="spinner" /></div>
                ) : (activeTab === 'fee' && viewMode === 'summary' ? feeSummary.length === 0 : filteredHistory.length === 0) ? (
                    <div className="tenant-empty">
                        <div className="tenant-empty-icon">📅</div>
                        <div className="tenant-empty-text">ไม่พบรายการในช่วงเวลานี้</div>
                    </div>
                ) : activeTab === 'fee' && viewMode === 'summary' ? (
                    <div style={{ overflowX: "auto" }}>
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th>บัญชี</th>
                                    <th style={{ textAlign: "right" }}>ยอดค่าธรรมเนียม</th>
                                    <th style={{ textAlign: "right" }}>เริ่มนับยอด</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feeSummary.map((acc) => (
                                    <tr
                                        key={acc.accountId}
                                        onClick={() => {
                                            setSelectedAccount(acc.accountId);
                                            setViewMode('detail');
                                        }}
                                        style={{ cursor: "pointer", transition: "background 0.2s" }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary)")}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                    >
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{acc.accountName}</div>
                                            {acc.phoneNumber && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{acc.phoneNumber}</div>}
                                        </td>
                                        <td style={{ textAlign: "right", fontWeight: 600, color: "var(--error)" }}>
                                            {acc.totalFee.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 13 }}>{formatDateTime(acc.firstActiveAt)}</div>
                                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>นับจากยอดแรก</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                                                    {entry.type === 'transaction'
                                                        ? `฿ ${(entry.amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                                                        : `฿ ${entry.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                                                    }
                                                </div>
                                                {selectedAccount === "all" && entry.accountName && (
                                                    <div style={{
                                                        fontSize: 11,
                                                        background: "var(--bg-secondary)",
                                                        padding: "2px 8px",
                                                        borderRadius: 12,
                                                        color: "var(--text-muted)",
                                                        border: "1px solid var(--border)"
                                                    }}>
                                                        {entry.accountName}
                                                    </div>
                                                )}
                                            </div>

                                            {/* DISPLAY LOGIC UPDATE: Simplified for positive changes */}
                                            <div style={{ marginTop: 4 }}>
                                                {isFee(entry) ? (
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
                                                        หักค่าธรรมเนียม
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: entry.change > 0 ? "var(--success)" : "var(--error)", display: "flex", alignItems: "center", gap: 8 }}>
                                                        <span>{entry.change > 0 ? "ยอดเงินเพิ่มขึ้น" : (entry.type === 'snapshot' ? "ยอดเงินลดลง" : "โอนเงินไป")}</span>

                                                        {entry.change > 0 ? (
                                                            <span style={{ color: "var(--text-primary)" }}>
                                                                +{Math.abs(entry.change).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: "var(--text-primary)" }}>
                                                                {entry.type === 'transaction'
                                                                    ? (entry.recipient || "Unknown")
                                                                    : `-${Math.abs(entry.change).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                                                                }
                                                            </span>
                                                        )}
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

                {/* Pagination Controls */}
                {!loadingHistory && (totalPages > 1 || page > 1) && (
                    <div style={{
                        marginTop: 20,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 16,
                        paddingTop: 16,
                        borderTop: "1px solid var(--border)"
                    }}>
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="tenant-btn-secondary"
                            style={{
                                padding: "6px 12px",
                                fontSize: 13,
                                opacity: page <= 1 ? 0.5 : 1,
                                cursor: page <= 1 ? "not-allowed" : "pointer",
                                border: "1px solid var(--border)",
                                background: "var(--bg-card)",
                                color: "var(--text-primary)",
                                borderRadius: 4
                            }}
                        >
                            &lt; ก่อนหน้า
                        </button>

                        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            หน้า {page} จาก {totalPages || 1}
                        </span>

                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="tenant-btn-secondary"
                            style={{
                                padding: "6px 12px",
                                fontSize: 13,
                                opacity: page >= totalPages ? 0.5 : 1,
                                cursor: page >= totalPages ? "not-allowed" : "pointer",
                                border: "1px solid var(--border)",
                                background: "var(--bg-card)",
                                color: "var(--text-primary)",
                                borderRadius: 4
                            }}
                        >
                            ถัดไป &gt;
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
