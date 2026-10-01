"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { openTenantBalanceStream } from "../../../lib/tenantSse";
import { useToast } from "../../../components/Toast";

interface Account {
    id: string;
    name: string;
    phoneNumber?: string;
}

interface HistoryEntry {
    id: string;
    balance: number;
    balanceSatang?: number;
    change: number;
    changeSatang?: number;
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
    accountId?: string;
}

interface FeeSummary {
    accountId: string;
    accountName: string;
    phoneNumber?: string;
    totalFee: number;
    firstActiveAt: string | null;
}

type Tab = "all" | "deposit" | "withdraw" | "fee";
type DateRange = "today" | "yesterday" | "3d" | "7d" | "15d" | "30d" | "all" | "custom";

export default function HistoryPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const { showToast } = useToast();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>("all");
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [feeSummary, setFeeSummary] = useState<FeeSummary[]>([]);
    const [viewMode, setViewMode] = useState<"summary" | "detail">("summary");

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

    const getDateRangeParams = useCallback((filter: DateRange) => {
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
        return "";
    }, [customStartDate, customEndDate]);

    const fetchHistory = useCallback(async (showLoading = false) => {
        if (!selectedAccount) return;

        if (showLoading) setLoadingHistory(true);
        const token = getToken();

        try {
            const dateParams = getDateRangeParams(dateFilter);

            // Fee Tab Summary Mode
            if (activeTab === "fee" && viewMode === "summary") {
                const url = `/api/tenant/${prefix}/accounts/fee-summary?${dateParams.replace('&', '')}`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

                if (res.status === 401) {
                    localStorage.removeItem("tenantToken");
                    window.location.href = `/tenant/${prefix}/login`;
                    return;
                }

                const data = await res.json();
                if (data.ok) {
                    setFeeSummary(data.data);
                    setTotalPages(1);
                    setTotalItems(data.data.length);
                }
            } else {
                const filterParam = `&filter=${activeTab}`;
                let url = "";
                if (selectedAccount === "all") {
                    url = `/api/tenant/${prefix}/accounts/all-history?limit=${limit}&page=${page}${dateParams}${filterParam}`;
                } else {
                    url = `/api/tenant/${prefix}/accounts/${selectedAccount}/history?limit=${limit}&page=${page}${dateParams}${filterParam}`;
                }

                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

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
    }, [selectedAccount, prefix, limit, page, dateFilter, activeTab, viewMode, getDateRangeParams]);

    // Reset pagination when filter criteria change
    useEffect(() => {
        setPage(1);
    }, [selectedAccount, limit, dateFilter, activeTab, viewMode]);

    // Switch view mode when tab changes
    useEffect(() => {
        if (activeTab !== 'fee') {
            setViewMode('summary');
        } else {
            setViewMode('summary');
            setSelectedAccount('all');
        }
    }, [activeTab]);

    // Fetch account list
    useEffect(() => {
        const fetchAccounts = async () => {
            const token = getToken();
            if (!token) return;

            try {
                const res = await fetch(`/api/tenant/${prefix}/accounts`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.ok) {
                    setAccounts(data.data || []);
                }
            } catch (e) {
                console.error("Error fetching accounts", e);
            }
            setLoading(false);
        };

        fetchAccounts();
    }, [prefix]);

    // Trigger history fetch when dependencies change
    useEffect(() => {
        if (selectedAccount) {
            fetchHistory(true);
        }
    }, [selectedAccount, fetchHistory]);

    // SSE Realtime Updates
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
                    } catch { }
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

    const isMoneyIn = (entry: HistoryEntry) => {
        if (entry.type === 'transaction') {
            return entry.direction === 'incoming';
        }
        return entry.change > 0;
    };

    const totalAmount = activeTab === 'fee' && viewMode === 'summary'
        ? feeSummary.reduce((sum, item) => sum + item.totalFee, 0)
        : history.reduce((sum, entry) => {
            const val = entry.type === 'transaction' && entry.amount ? entry.amount : Math.abs(entry.change);
            return sum + val;
        }, 0);

    const formatDateTime = (dateStr?: string | null) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return d.toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    };

    const copyText = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast({ type: "success", title: "คัดลอกแล้ว", message: label });
        } catch {
            showToast({ type: "error", title: "ล้มเหลว", message: "ไม่สามารถคัดลอกได้" });
        }
    };

    if (loading) {
        return (
            <div className="flex-center p-60">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="tenant-page-header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {activeTab === 'fee' && viewMode === 'detail' && (
                        <button
                            type="button"
                            onClick={() => {
                                setViewMode('summary');
                                setSelectedAccount('all');
                            }}
                            className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                            style={{ padding: "6px 12px" }}
                        >
                            ← กลับสู่สรุป
                        </button>
                    )}
                    <div>
                        <h1 className="tenant-page-title">
                            {activeTab === 'fee' && viewMode === 'detail'
                                ? `ประวัติค่าธรรมเนียม: ${accounts.find(a => a.id === selectedAccount)?.name || 'รายบัญชี'}`
                                : "ประวัติทำรายการ"}
                        </h1>
                        <p style={{ fontSize: 13, color: "var(--theme-text-muted)", marginTop: 2 }}>
                            ตรวจสอบและติดตามบันทึกธุรกรรมการเงินและยอดเงินในรูปแบบตาราง
                        </p>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {/* Live Indicator */}
                    {activeTab !== 'fee' && selectedAccount !== 'all' && (
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            borderRadius: 6,
                            background: "var(--theme-card)",
                            border: "1px solid var(--theme-border)",
                            fontSize: 12,
                            fontWeight: 600,
                        }}>
                            <span style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: isConnected ? "var(--theme-success)" : "var(--theme-error)",
                                boxShadow: isConnected ? "0 0 8px var(--theme-success)" : "none",
                            }} />
                            <span style={{ color: isConnected ? "var(--theme-success)" : "var(--theme-error)" }}>
                                {isConnected ? "เชื่อมต่อเรียลไทม์" : "ออฟไลน์"}
                            </span>
                        </div>
                    )}

                    {/* Account Selector */}
                    {activeTab !== 'fee' && (
                        <select
                            className="tenant-form-select"
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            style={{ width: "auto", minWidth: 200 }}
                        >
                            <option value="all">ทั้งหมด (รวมทุกวอลเล็ท)</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.name} {acc.phoneNumber ? `(${acc.phoneNumber})` : ""}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Limit Selector */}
                    {(activeTab !== 'fee' || viewMode === 'detail') && (
                        <select
                            className="tenant-form-select"
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            style={{ width: "auto" }}
                        >
                            <option value={20}>20 แถว</option>
                            <option value={50}>50 แถว</option>
                            <option value={100}>100 แถว</option>
                            <option value={300}>300 แถว</option>
                        </select>
                    )}
                </div>
            </div>

            {/* Control Bar & Tabs */}
            <div className="tenant-card" style={{ marginBottom: 20, padding: 18 }}>
                {/* Category Tabs */}
                <div style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 16,
                    borderBottom: "1px solid var(--theme-border)",
                    paddingBottom: 14,
                    flexWrap: "wrap",
                }}>
                    <button
                        type="button"
                        className={`tenant-btn ${activeTab === "all" ? "tenant-btn-primary" : "tenant-btn-secondary"}`}
                        onClick={() => setActiveTab("all")}
                    >
                        📋 รายการทั้งหมด
                    </button>
                    <button
                        type="button"
                        className={`tenant-btn ${activeTab === "deposit" ? "tenant-btn-primary" : "tenant-btn-secondary"}`}
                        onClick={() => setActiveTab("deposit")}
                    >
                        🟢 เงินเข้า (Deposit)
                    </button>
                    <button
                        type="button"
                        className={`tenant-btn ${activeTab === "withdraw" ? "tenant-btn-primary" : "tenant-btn-secondary"}`}
                        onClick={() => setActiveTab("withdraw")}
                    >
                        🔴 เงินออก (Withdraw)
                    </button>
                    <button
                        type="button"
                        className={`tenant-btn ${activeTab === "fee" ? "tenant-btn-primary" : "tenant-btn-secondary"}`}
                        onClick={() => setActiveTab("fee")}
                    >
                        ⚪ ค่าธรรมเนียมระบบ (Fee)
                    </button>
                </div>

                {/* Date Filters */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--theme-text-muted)", marginRight: 6 }}>ช่วงเวลา:</span>
                    {[
                        { key: "today", label: "วันนี้" },
                        { key: "yesterday", label: "เมื่อวาน" },
                        { key: "3d", label: "3 วัน" },
                        { key: "7d", label: "7 วัน" },
                        { key: "15d", label: "15 วัน" },
                        { key: "30d", label: "30 วัน" },
                        { key: "all", label: "ทั้งหมด" },
                        { key: "custom", label: "กำหนดเอง..." },
                    ].map((btn) => (
                        <button
                            key={btn.key}
                            type="button"
                            className={`tenant-btn tenant-btn-sm ${dateFilter === btn.key ? "tenant-btn-primary" : "tenant-btn-secondary"}`}
                            onClick={() => setDateFilter(btn.key as DateRange)}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {/* Custom Date Range Picker */}
                {dateFilter === "custom" && (
                    <div style={{
                        display: "flex",
                        gap: 12,
                        marginTop: 14,
                        paddingTop: 14,
                        borderTop: "1px dashed var(--theme-border)",
                        alignItems: "center",
                        flexWrap: "wrap",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, color: "var(--theme-text-muted)" }}>ตั้งแต่วันที่:</span>
                            <input
                                type="date"
                                className="tenant-form-input"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{ width: "auto" }}
                            />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, color: "var(--theme-text-muted)" }}>ถึงวันที่:</span>
                            <input
                                type="date"
                                className="tenant-form-input"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={{ width: "auto" }}
                            />
                        </div>
                        <button
                            type="button"
                            className="tenant-btn tenant-btn-primary tenant-btn-sm"
                            onClick={() => fetchHistory(true)}
                            disabled={!customStartDate || !customEndDate}
                        >
                            ค้นหาข้อมูล
                        </button>
                    </div>
                )}
            </div>

            {/* KPI Summary Cards */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
                marginBottom: 20,
            }}>
                <div className="tenant-card" style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--theme-text-muted)", textTransform: "uppercase" }}>
                        ยอดรวม ({activeTab === 'fee' ? 'ค่าธรรมเนียม' : activeTab === 'deposit' ? 'เงินเข้า' : activeTab === 'withdraw' ? 'เงินออก' : 'ธุรกรรม'})
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--theme-text-primary)", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>
                        ฿ {totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="tenant-card" style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--theme-text-muted)", textTransform: "uppercase" }}>
                        จำนวนรายการทั้งหมด
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--theme-text-primary)", marginTop: 4 }}>
                        {activeTab === 'fee' && viewMode === 'summary'
                            ? `${feeSummary.length} บัญชี`
                            : `${totalItems.toLocaleString()} รายการ`
                        }
                    </div>
                </div>

                <div className="tenant-card" style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--theme-text-muted)", textTransform: "uppercase" }}>
                        วอลเล็ทที่กำลังดู
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--theme-text-primary)", marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {selectedAccount === "all" ? "ทุกวอลเล็ทในเครือข่าย" : accounts.find(a => a.id === selectedAccount)?.name || "-"}
                    </div>
                </div>
            </div>

            {/* TABLE SECTION */}
            <div className="tenant-table-container">
                {loadingHistory ? (
                    <div className="flex-center p-60">
                        <div className="spinner" />
                    </div>
                ) : activeTab === 'fee' && viewMode === 'summary' ? (
                    // Fee Summary Table
                    feeSummary.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--theme-text-muted)" }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>ไม่พบรายการค่าธรรมเนียมในช่วงเวลานี้</div>
                        </div>
                    ) : (
                        <div className="tenant-table-wrapper">
                            <table className="tenant-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 50 }}>#</th>
                                        <th>บัญชีวอลเล็ท</th>
                                        <th>เบอร์โทรศัพท์</th>
                                        <th style={{ textAlign: "right" }}>ยอดค่าธรรมเนียมสะสม</th>
                                        <th>วันที่เริ่มบันทึกยอด</th>
                                        <th style={{ textAlign: "center", width: 140 }}>การดำเนินการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {feeSummary.map((acc, index) => (
                                        <tr key={acc.accountId}>
                                            <td style={{ color: "var(--theme-text-muted)" }}>{index + 1}</td>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{acc.accountName}</div>
                                            </td>
                                            <td>
                                                <span className="badge badge-neutral" style={{ fontFamily: "monospace" }}>
                                                    {acc.phoneNumber || "-"}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                <span className="amount-negative">
                                                    -฿ {acc.totalFee.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 13, color: "var(--theme-text-secondary)" }}>
                                                {formatDateTime(acc.firstActiveAt)}
                                            </td>
                                            <td style={{ textAlign: "center" }}>
                                                <button
                                                    type="button"
                                                    className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                    onClick={() => {
                                                        setSelectedAccount(acc.accountId);
                                                        setViewMode('detail');
                                                    }}
                                                >
                                                    ดูรายการย่อย →
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    // Transaction Data Table (Formal Table Mode)
                    history.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--theme-text-muted)" }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>ไม่พบรายการธุรกรรมในช่วงเวลาที่เลือก</div>
                        </div>
                    ) : (
                        <div className="tenant-table-wrapper">
                            <table className="tenant-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 45 }}>#</th>
                                        <th>วัน-เวลาทำรายการ</th>
                                        <th>บัญชีวอลเล็ท</th>
                                        <th>ประเภท</th>
                                        <th style={{ textAlign: "right" }}>จำนวนเงิน</th>
                                        <th style={{ textAlign: "right" }}>ยอดเงินคงเหลือ</th>
                                        <th>คู่โอน / บันทึกรายละเอียด</th>
                                        <th style={{ textAlign: "center" }}>สถานะ</th>
                                        <th style={{ textAlign: "center", width: 120 }}>รหัสอ้างอิง</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((entry, index) => {
                                        const isEntryFee = isFee(entry);
                                        const isIncoming = isMoneyIn(entry);
                                        const amountDisplay = entry.type === 'transaction' && entry.amount
                                            ? entry.amount
                                            : Math.abs(entry.change);

                                        return (
                                            <tr key={entry.id}>
                                                <td style={{ color: "var(--theme-text-muted)", fontSize: 12 }}>
                                                    {(page - 1) * limit + index + 1}
                                                </td>

                                                {/* Date & Time */}
                                                <td style={{ whiteSpace: "nowrap" }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                                                        {formatDateTime(entry.checkedAt)}
                                                    </div>
                                                </td>

                                                {/* Account Info */}
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{entry.accountName || "วอลเล็ท"}</div>
                                                    {entry.mobileNo && (
                                                        <span className="badge badge-neutral" style={{ fontSize: 10, marginTop: 2, fontFamily: "monospace" }}>
                                                            {entry.mobileNo}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Transaction Type */}
                                                <td>
                                                    {isEntryFee ? (
                                                        <span className="badge badge-neutral">ค่าธรรมเนียม</span>
                                                    ) : isIncoming ? (
                                                        <span className="badge badge-success">เงินเข้า (IN)</span>
                                                    ) : (
                                                        <span className="badge badge-error">เงินออก (OUT)</span>
                                                    )}
                                                </td>

                                                {/* Amount */}
                                                <td style={{ textAlign: "right" }}>
                                                    {isEntryFee ? (
                                                        <span className="amount-fee">
                                                            -฿ {amountDisplay.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                                        </span>
                                                    ) : isIncoming ? (
                                                        <span className="amount-positive">
                                                            +฿ {amountDisplay.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                                        </span>
                                                    ) : (
                                                        <span className="amount-negative">
                                                            -฿ {amountDisplay.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Running Balance */}
                                                <td style={{ textAlign: "right" }}>
                                                    {entry.balance > 0 ? (
                                                        <span className="amount-neutral" style={{ color: "var(--theme-text-secondary)" }}>
                                                            ฿ {entry.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: "var(--theme-text-muted)", fontSize: 12 }}>-</span>
                                                    )}
                                                </td>

                                                {/* Counterparty / Details */}
                                                <td style={{ maxWidth: 260 }}>
                                                    {isEntryFee ? (
                                                        <div style={{ color: "var(--theme-text-secondary)", fontSize: 12.5 }}>
                                                            หักค่าธรรมเนียมการโอนเงิน/ระบบ TrueMoney
                                                        </div>
                                                    ) : entry.type === 'transaction' ? (
                                                        <div>
                                                            {entry.sender && (
                                                                <div style={{ fontSize: 12 }}>
                                                                    <span style={{ color: "var(--theme-text-muted)" }}>ผู้โอน: </span>
                                                                    <span style={{ fontWeight: 600 }}>{entry.sender}</span>
                                                                </div>
                                                            )}
                                                            {entry.recipient && (
                                                                <div style={{ fontSize: 12 }}>
                                                                    <span style={{ color: "var(--theme-text-muted)" }}>ผู้รับ: </span>
                                                                    <span style={{ fontWeight: 600 }}>{entry.recipient}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: "var(--theme-text-secondary)", fontSize: 12.5 }}>
                                                            {entry.change > 0 ? "ยอดเงินในวอลเล็ทเพิ่มขึ้น" : "ยอดเงินในวอลเล็ทลดลง"}
                                                            <span style={{ color: "var(--theme-text-muted)", fontSize: 11, marginLeft: 4 }}>
                                                                ({entry.source || "เช็คยอด"})
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td style={{ textAlign: "center" }}>
                                                    <span className={`badge ${entry.status === 'FAILED' ? 'badge-error' : 'badge-success'}`}>
                                                        {entry.status === 'FAILED' ? 'ล้มเหลว' : 'สำเร็จ'}
                                                    </span>
                                                </td>

                                                {/* Reference / Action */}
                                                <td style={{ textAlign: "center" }}>
                                                    <button
                                                        type="button"
                                                        className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                        onClick={() => copyText(entry.id, "รหัสอ้างอิง")}
                                                        title={entry.id}
                                                        style={{ fontSize: 11, padding: "4px 8px", fontFamily: "monospace" }}
                                                    >
                                                        {entry.id.length > 8 ? `${entry.id.slice(0, 6)}...` : entry.id}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}

                {/* Pagination Controls */}
                {!loadingHistory && (totalPages > 1 || page > 1) && (
                    <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px 20px",
                        borderTop: "1px solid var(--theme-border)",
                        background: "var(--theme-bg-subtle)",
                        flexWrap: "wrap",
                        gap: 12,
                    }}>
                        <span style={{ fontSize: 13, color: "var(--theme-text-muted)" }}>
                            แสดง {(page - 1) * limit + 1} - {Math.min(page * limit, totalItems)} จากทั้งหมด {totalItems.toLocaleString()} รายการ
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                style={{ opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}
                            >
                                ← หน้าก่อนหน้า
                            </button>

                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--theme-text-primary)" }}>
                                {page} / {totalPages || 1}
                            </span>

                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                style={{ opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? "not-allowed" : "pointer" }}
                            >
                                หน้าถัดไป →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
