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
    // New fields
    type?: string;
    amount?: number;
    fee?: number;
    direction?: string;
    sender?: string;
    recipient?: string;
    status?: string;
}

export default function HistoryPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    const fetchHistory = useCallback(async (showLoading = false) => {
        if (!selectedAccount) return;

        if (showLoading) setLoadingHistory(true);
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
    }, [selectedAccount, prefix]);

    // Fetch accounts on mount
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

    // Fetch history when account changes
    useEffect(() => {
        if (selectedAccount) {
            fetchHistory(true);
        }
    }, [selectedAccount, fetchHistory]);

    // Setup SSE connection for real-time updates
    useEffect(() => {
        if (!selectedAccount) return;

        // Close existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        // Create new SSE connection
        const eventSource = new EventSource(`/api/sse/balance/${selectedAccount}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            console.log("[SSE] Connected to balance updates");
            setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("[SSE] Received:", data);

                if (data.type === "update") {
                    // New balance update - refresh history
                    fetchHistory(false);
                }
            } catch (e) {
                console.error("[SSE] Parse error:", e);
            }
        };

        eventSource.onerror = () => {
            console.log("[SSE] Connection error, reconnecting...");
            setIsConnected(false);
        };

        // Cleanup on unmount or account change
        return () => {
            eventSource.close();
            setIsConnected(false);
        };
    }, [selectedAccount, fetchHistory]);

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

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    {/* Live indicator */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: isConnected ? "#22c55e" : "#ef4444",
                            animation: isConnected ? "pulse 2s infinite" : "none",
                        }} />
                        <span style={{ fontSize: 12, color: isConnected ? "#22c55e" : "#ef4444" }}>
                            {isConnected ? "LIVE" : "OFFLINE"}
                        </span>
                    </div>

                    {/* Account selector */}
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
            </div>

            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>

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
                            ระบบจะบันทึกอัตโนมัติเมื่อยอดเงินเปลี่ยนแปลง (Real-time)
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
                                            {/* Header: Amount */}
                                            <div style={{
                                                fontSize: 20,
                                                fontWeight: 700,
                                                color: "var(--text-primary)"
                                            }}>
                                                {entry.type === 'transaction'
                                                    ? `฿ ${(entry.amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                                                    : `฿ ${entry.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                                                }
                                            </div>

                                            {/* Sub-header: Change / Details */}
                                            {entry.type === 'transaction' ? (
                                                <div style={{ marginTop: 8 }}>
                                                    <div style={{
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        color: entry.direction === 'incoming' ? "var(--success)" : "var(--error)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8
                                                    }}>
                                                        <span>{entry.direction === 'incoming' ? "รับเงินจาก" : "โอนเงินไป"}</span>
                                                        <span style={{ color: "var(--text-primary)" }}>
                                                            {entry.direction === 'incoming' ? entry.sender : entry.recipient}
                                                        </span>
                                                    </div>

                                                    {entry.fee !== undefined && entry.fee > 0 && (
                                                        <div style={{
                                                            fontSize: 12,
                                                            color: "var(--error)",
                                                            marginTop: 2,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 4
                                                        }}>
                                                            <span>ค่าธรรมเนียม:</span>
                                                            <strong>฿ {entry.fee.toLocaleString()}</strong>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                entry.change !== 0 && (
                                                    <div style={{
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        color: entry.change > 0 ? "var(--success)" : "var(--error)",
                                                        marginTop: 4,
                                                    }}>
                                                        {entry.change > 0 ? "+" : ""}
                                                        {entry.change.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                                {formatDate(entry.checkedAt)}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                {formatTime(entry.checkedAt)}
                                            </div>
                                            {entry.type === 'transaction' && (
                                                <div style={{
                                                    marginTop: 4,
                                                    fontSize: 11,
                                                    padding: "2px 6px",
                                                    borderRadius: 4,
                                                    background: "var(--bg-secondary)",
                                                    color: "var(--text-muted)",
                                                    display: "inline-block"
                                                }}>
                                                    Webhook
                                                </div>
                                            )}
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
