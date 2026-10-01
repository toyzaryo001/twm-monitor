"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "../../../components/Toast";
import { openTenantBalanceStream } from "../../../lib/tenantSse";

interface Account {
    id: string;
    name: string;
    phoneNumber?: string;
    isActive: boolean;
    walletEndpointUrl: string;
    stats?: {
        totalFee: number;
        firstActiveAt: string | null;
    };
    webhookSecret?: string | null;
    webhookSecretConfigured?: boolean;
}

interface BalanceData {
    balance: number;
    checkedAt: string;
}

const TRUE_MONEY_BALANCE_ENDPOINT = "https://apis.truemoneyservices.com/account/v1/balance";

const createEmptyWalletForm = () => ({
    name: "",
    phoneNumber: "",
    walletEndpointUrl: TRUE_MONEY_BALANCE_ENDPOINT,
    walletBearerToken: "",
    webhookSecret: "",
});

function getWalletErrorMessage(data: any) {
    if (data.error === "WALLET_API_UNREACHABLE") {
        return "ไม่สามารถเชื่อมต่อ Wallet API ได้";
    }

    if (data.error === "WALLET_API_ERROR") {
        const status = data.status ? ` (HTTP ${data.status})` : "";
        const rawDetail = data.detail ? String(data.detail) : "";
        if (rawDetail.includes("No user profile")) {
            return `Wallet API ไม่พบโปรไฟล์ผู้ใช้${status} กรุณาตรวจ Bearer Token หรือผูกวอลเล็ทใหม่`;
        }

        const detail = rawDetail ? `: ${rawDetail.slice(0, 120)}` : "";
        return `Wallet API ตอบกลับผิดพลาด${status}${detail}`;
    }

    return "เกิดข้อผิดพลาด: " + data.error;
}

export default function WalletsPage() {
    const params = useParams();
    const { showToast } = useToast();
    const prefix = params.prefix as string;
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [balances, setBalances] = useState<Record<string, BalanceData | null>>({});
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(createEmptyWalletForm);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    const fetchAccounts = async () => {
        const token = getToken();
        if (!token) {
            window.location.href = `/tenant/${prefix}/login`;
            return;
        }

        try {
            const res = await fetch(`/api/tenant/${prefix}/accounts`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            // If unauthorized, redirect to login
            if (res.status === 401) {
                localStorage.removeItem("tenantToken");
                window.location.href = `/tenant/${prefix}/login`;
                return;
            }

            const data = await res.json();
            if (data.ok) {
                setAccounts(data.data);
                // Fetch cached balances for all accounts
                for (const account of data.data) {
                    fetchCachedBalance(account.id);
                }
            }
        } catch (e) {
            console.error("Error fetching accounts", e);
        }
        setLoading(false);
    };

    const fetchCachedBalance = async (accountId: string) => {
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
    };

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

    const handleCopyRoundedBalance = async (account: Account) => {
        const balance = balances[account.id]?.balance;

        if (typeof balance !== "number") {
            showToast({
                type: "error",
                title: "ยังไม่มียอดเงิน",
                message: "กรุณารอโหลดข้อมูล หรือกดเช็คยอดก่อนคัดลอก",
            });
            return;
        }

        const roundedBalance = Math.round(balance);
        const formattedRoundedBalance = roundedBalance.toLocaleString("en-US");

        try {
            await navigator.clipboard.writeText(formattedRoundedBalance);
            showToast({
                type: "success",
                title: "คัดลอกยอดแล้ว",
                message: `ยอดปัดเศษ: ฿ ${formattedRoundedBalance}`,
            });
        } catch {
            showToast({
                type: "error",
                title: "คัดลอกไม่สำเร็จ",
                message: "เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ",
            });
        }
    };

    // Auto-Withdraw feature disabled - TrueMoney API not accessible
    const [featureAutoWithdrawEnabled, setFeatureAutoWithdrawEnabled] = useState(false);

    useEffect(() => {
        fetchAccounts();

        // Feature Flag for Auto-Withdraw - DISABLED
        // The TrueMoney P2P API is not publicly accessible, so this feature is disabled.
        // Original code fetched network config to check featureAutoWithdraw flag
        /*
        const fetchNetworkConfig = async () => {
            const token = getToken();
            if (!token) return;
            try {
                const res = await fetch(`/api/tenant/${prefix}/stats`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                if (data.ok && data.data.network) {
                    setFeatureAutoWithdrawEnabled(data.data.network.featureAutoWithdraw === true);
                }
            } catch (e) { console.error("Error fetching network config", e); }
        };
        fetchNetworkConfig();
        */
    }, [prefix]);

    // Real-time balance updates via SSE
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = getToken();

        const url = editingId ? `/api/tenant/${prefix}/accounts/${editingId}` : `/api/tenant/${prefix}/accounts`;
        const method = editingId ? "PUT" : "POST";

        // Prepare payload, remove empty token if editing
        const payload: any = { ...form, walletEndpointUrl: TRUE_MONEY_BALANCE_ENDPOINT };
        if (editingId && !payload.walletBearerToken) {
            delete payload.walletBearerToken;
        }

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!data.ok) {
                showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: data.error || "ไม่สามารถบันทึกข้อมูลได้" });
                return;
            }

            showToast({ type: "success", title: "สำเร็จ", message: editingId ? "แก้ไขวอลเล็ทเรียบร้อยแล้ว" : "เพิ่มวอลเล็ทเรียบร้อยแล้ว" });

            setShowModal(false);
            setEditingId(null);
            setForm(createEmptyWalletForm());
            fetchAccounts();
        } catch (e) {
            showToast({ type: "error", title: "ล้มเหลว", message: "เกิดข้อผิดพลาดในการบันทึก" });
        }
    };

    const handleEdit = (account: Account) => {
        setForm({
            name: account.name,
            phoneNumber: account.phoneNumber || "",
            walletEndpointUrl: TRUE_MONEY_BALANCE_ENDPOINT,
            walletBearerToken: "", // Leave blank to keep existing
            webhookSecret: account.webhookSecret || "",
        });
        setEditingId(account.id);
        setShowModal(true);
    };

    const handleToggle = async (account: Account) => {
        const token = getToken();
        await fetch(`/api/tenant/${prefix}/accounts/${account.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ isActive: !account.isActive }),
        });
        fetchAccounts();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("ยืนยันการลบวอลเล็ท?")) return;
        const token = getToken();
        try {
            const res = await fetch(`/api/tenant/${prefix}/accounts/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                showToast({ type: "success", title: "สำเร็จ", message: "ลบวอลเล็ทเรียบร้อยแล้ว" });
                fetchAccounts();
            } else {
                showToast({ type: "error", title: "ล้มเหลว", message: "ไม่สามารถลบวอลเล็ทได้" });
            }
        } catch (e) {
            showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: "เกิดข้อผิดพลาดในการลบ" });
        }
    };

    const getWebhookUrl = (phoneNumber?: string, webhookSecret?: string) => {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        if (webhookSecret?.trim()) return `${origin}/api/webhook/${prefix}`;
        const mobile = phoneNumber?.trim() || "08x...";
        return `${origin}/api/webhook/${prefix}?mobile=${mobile}`;
    };

    const copyText = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            showToast({ type: "success", title: "คัดลอกแล้ว", message: label });
        } catch {
            showToast({ type: "error", title: "คัดลอกไม่สำเร็จ", message: "เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ" });
        }
    };

    // Auto Withdraw System
    interface AutoWithdrawSettings {
        enabled: boolean;
        triggerMinBalance: number;
        targetNumber: string;
        withdrawType: string;
        amountValue: number;
    }

    const [showAutoWithdrawModal, setShowAutoWithdrawModal] = useState(false);
    const [editingAutoWithdrawId, setEditingAutoWithdrawId] = useState<string | null>(null);
    const [autoWithdrawForm, setAutoWithdrawForm] = useState<AutoWithdrawSettings>({
        enabled: false,
        triggerMinBalance: 1000,
        targetNumber: "",
        withdrawType: "ALL_EXCEPT",
        amountValue: 0
    });

    const handleOpenAutoWithdraw = async (account: Account) => {
        setEditingAutoWithdrawId(account.id);
        const token = getToken();
        // Fetch existing config
        try {
            const res = await fetch(`/api/tenant/${prefix}/accounts/${account.id}/auto-withdraw`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok && data.data) {
                setAutoWithdrawForm({
                    enabled: data.data.enabled,
                    triggerMinBalance: data.data.triggerMinBalance,
                    targetNumber: data.data.targetNumber,
                    withdrawType: data.data.withdrawType,
                    amountValue: data.data.amountValue
                });
            } else {
                // Default
                setAutoWithdrawForm({
                    enabled: false,
                    triggerMinBalance: 1000,
                    targetNumber: "",
                    withdrawType: "ALL_EXCEPT",
                    amountValue: 0
                });
            }
        } catch (e) {
            console.error("Error fetching config", e);
        }
        setShowAutoWithdrawModal(true);
    };

    const handleSaveAutoWithdraw = async () => {
        if (!editingAutoWithdrawId) return;
        const token = getToken();

        if (!autoWithdrawForm.targetNumber) {
            alert("กรุณาระบุเบอร์ปลายทาง");
            return;
        }

        try {
            const res = await fetch(`/api/tenant/${prefix}/accounts/${editingAutoWithdrawId}/auto-withdraw`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(autoWithdrawForm)
            });
            const data = await res.json();
            if (data.ok) {
                showToast({ type: "success", title: "บันทึกสำเร็จ", message: "ตั้งค่าโอนอัตโนมัติเรียบร้อยแล้ว" });
                setShowAutoWithdrawModal(false);
            } else {
                showToast({ type: "error", title: "ผิดพลาด", message: "ไม่สามารถบันทึกได้" });
            }
        } catch (e) {
            showToast({ type: "error", title: "ผิดพลาด", message: "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
        }
    };

    if (loading) {
        return (
            <div className="flex-center" style={{ padding: 60 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            <div className="tenant-page-header">
                <h1 className="tenant-page-title">จัดการวอลเล็ท</h1>
                <button className="tenant-btn tenant-btn-primary" onClick={() => {
                    setForm(createEmptyWalletForm());
                    setEditingId(null);
                    setShowModal(true);
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><path d="M12 5v14m-7-7h14"/></svg>
                    เพิ่มวอลเล็ท
                </button>
            </div>

            {accounts.length === 0 ? (
                <div className="tenant-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--theme-text-muted)" strokeWidth="1.5" style={{ marginBottom: 16 }}>
                        <rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                    </svg>
                    <div style={{ color: 'var(--theme-text-primary)', fontSize: '1.1rem', fontWeight: 500, marginBottom: 8 }}>ยังไม่มีวอลเล็ท</div>
                    <div style={{ color: 'var(--theme-text-muted)', marginBottom: 24 }}>เพิ่มวอลเล็ทแรกเพื่อเริ่มต้นใช้งานระบบ</div>
                    <button
                        className="tenant-btn tenant-btn-primary"
                        onClick={() => {
                            setForm(createEmptyWalletForm());
                            setEditingId(null);
                            setShowModal(true);
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><path d="M12 5v14m-7-7h14"/></svg>
                        เพิ่มวอลเล็ทแรก
                    </button>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
                    {accounts.map((account) => (
                        <div key={account.id} className="tenant-card" style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: "var(--theme-text-primary)", fontSize: "1.1rem" }}>{account.name}</div>
                                    <div style={{ color: "var(--theme-text-muted)", fontSize: "0.9rem", marginTop: 4 }}>{account.phoneNumber || "ไม่ระบุเบอร์"}</div>
                                </div>
                                <span className={`badge ${account.isActive ? "badge-success" : "badge-neutral"}`}>
                                    {account.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                                </span>
                            </div>

                            <div style={{ padding: "16px 0", borderTop: "1px solid var(--theme-border-subtle)", borderBottom: "1px solid var(--theme-border-subtle)", marginBottom: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <div style={{ color: "var(--theme-text-secondary)", fontSize: "0.9rem" }}>ยอดเงินคงเหลือ</div>
                                    <button
                                        type="button"
                                        className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                        onClick={() => handleCopyRoundedBalance(account)}
                                        disabled={!balances[account.id]}
                                        title={balances[account.id] ? `คัดลอก ${Math.round(balances[account.id]!.balance).toLocaleString("en-US")}` : "รอโหลดข้อมูลยอดเงิน"}
                                        style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                        คัดลอก
                                    </button>
                                </div>
                                <div className="amount-positive" style={{ fontFamily: "monospace", fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>
                                    {balances[account.id] ? `฿ ${balances[account.id]!.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "฿ ---.--"}
                                </div>
                                {balances[account.id] && (
                                    <div style={{ fontSize: "0.8rem", color: "var(--theme-text-muted)", marginTop: 8 }}>
                                        อัพเดทเมื่อ: {new Date(balances[account.id]!.checkedAt).toLocaleString("th-TH")}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <span style={{ color: "var(--theme-text-secondary)", fontSize: "0.9rem" }}>ค่าธรรมเนียมสะสม</span>
                                    <span className="amount-negative" style={{ fontFamily: "monospace", fontWeight: 600 }}>
                                        ฿ {(account.stats?.totalFee || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ color: "var(--theme-text-secondary)", fontSize: "0.9rem" }}>เริ่มนับเมื่อ</span>
                                    <span style={{ color: "var(--theme-text-muted)", fontSize: "0.9rem" }}>
                                        {(account.stats?.totalFee || 0) > 0 && account.stats?.firstActiveAt
                                            ? new Date(account.stats.firstActiveAt).toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: 'numeric' })
                                            : "ไม่มีข้อมูล"
                                        }
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "8px", marginTop: "auto", flexWrap: "wrap" }}>
                                <button
                                    className="tenant-btn tenant-btn-primary tenant-btn-sm"
                                    style={{ flex: 1, minWidth: "100px", justifyContent: "center" }}
                                    onClick={() => handleCheckBalance(account.id)}
                                    disabled={checkingId === account.id}
                                >
                                    {checkingId === account.id ? (
                                        <span className="spinner" style={{ width: 14, height: 14, marginRight: 6 }}></span>
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                                    )}
                                    เช็คยอด
                                </button>
                                {featureAutoWithdrawEnabled && (
                                    <button
                                        className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                        onClick={() => handleOpenAutoWithdraw(account)}
                                        title="ตั้งค่าโอนอัตโนมัติ"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                    </button>
                                )}
                                <button
                                    className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                    onClick={() => handleToggle(account)}
                                    title={account.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                >
                                    {account.isActive ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    )}
                                </button>
                                <button
                                    className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                    onClick={() => handleEdit(account)}
                                    title="แก้ไข"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button
                                    className="tenant-btn tenant-btn-danger tenant-btn-sm"
                                    onClick={() => handleDelete(account.id)}
                                    title="ลบ"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Wallet Modal */}
            {showModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: 20
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="tenant-card"
                        style={{ maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--theme-text-primary)", marginBottom: 24 }}>
                            {editingId ? "แก้ไขวอลเล็ท" : "เพิ่มวอลเล็ท TrueWallet"}
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="tenant-form-group">
                                <label className="tenant-form-label">ชื่อวอลเล็ท</label>
                                <input
                                    type="text"
                                    className="tenant-form-input"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="เช่น บัญชีหลัก"
                                    required
                                />
                            </div>

                            <div className="tenant-form-group">
                                <label className="tenant-form-label">เบอร์โทรศัพท์</label>
                                <input
                                    type="text"
                                    className="tenant-form-input"
                                    value={form.phoneNumber}
                                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                                    placeholder="08x-xxx-xxxx"
                                />
                            </div>

                            <div className="tenant-form-group">
                                <label className="tenant-form-label">Wallet API Endpoint (เช็คยอดเงิน)</label>
                                <div className="webhook-code-row">
                                    <code>{TRUE_MONEY_BALANCE_ENDPOINT}</code>
                                </div>
                                <div style={{ fontSize: "0.85rem", color: "var(--theme-text-muted)", marginTop: 6 }}>
                                    ระบบใช้ URL นี้เช็คยอดเงินอัตโนมัติทุกวอลเล็ท ไม่ต้องกรอกหรือแก้ไขเอง
                                </div>
                            </div>

                            <div className="tenant-form-group">
                                <label className="tenant-form-label">Balance Bearer Token</label>
                                <input
                                    type="text"
                                    className="tenant-form-input"
                                    value={form.walletBearerToken}
                                    onChange={(e) => setForm({ ...form, walletBearerToken: e.target.value })}
                                    placeholder="API Token"
                                    required={!editingId}
                                />
                                <div style={{ fontSize: "0.85rem", color: "var(--theme-text-muted)", marginTop: 6 }}>
                                    Token สำหรับเช็คยอดเงินเท่านั้น ไม่ใช่ Header Key จากหน้าแจ้งหักค่าธรรมเนียม
                                    {editingId ? " เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน token เช็คยอด" : ""}
                                </div>
                            </div>

                            <div className="tenant-form-group">
                                <label className="tenant-form-label">Webhook Header Key (Authorization)</label>
                                <input
                                    type="text"
                                    className="tenant-form-input"
                                    value={form.webhookSecret}
                                    onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                                    placeholder="วาง Key จากหน้าแจ้งหักค่าธรรมเนียม"
                                />
                                <div style={{ fontSize: "0.85rem", color: "var(--theme-text-muted)", marginTop: 6 }}>
                                    Key นี้ใช้ตรวจ header <code>Authorization</code> และใช้แยกวอลเล็ทได้โดยไม่ต้องใส่เบอร์ใน Endpoint URL
                                    หากเว้นว่าง ระบบจะใช้เบอร์ใน URL เพื่อแยกวอลเล็ทแทน
                                </div>
                            </div>

                            <div style={{ background: "var(--theme-surface-hover)", padding: 16, borderRadius: 8, border: "1px solid var(--theme-border-subtle)", marginTop: 24 }}>
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: 600, color: "var(--theme-text-primary)", marginBottom: 4 }}>ลิงก์รับแจ้งถอน / ค่าธรรมเนียม</div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--theme-text-muted)" }}>
                                        ใช้ข้อมูลชุดนี้ในหน้าแจ้งหักค่าธรรมเนียมของแอพ
                                    </div>
                                    <div style={{ marginTop: 8 }}>
                                        <span className={`badge ${(form.webhookSecret.trim() || form.phoneNumber.trim()) ? "badge-success" : "badge-neutral"}`}>
                                            {form.webhookSecret.trim() ? "ใช้ Header Key แยกวอลเล็ท" : form.phoneNumber.trim() ? "ใช้เบอร์ใน URL" : "ใส่ Key หรือเบอร์ก่อน"}
                                        </span>
                                    </div>
                                </div>

                                <div className="tenant-form-group">
                                    <label className="tenant-form-label">Endpoint URL</label>
                                    <div className="webhook-code-row">
                                        <code>{getWebhookUrl(form.phoneNumber, form.webhookSecret)}</code>
                                        <button
                                            type="button"
                                            className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                            disabled={!form.webhookSecret.trim() && !form.phoneNumber.trim()}
                                            onClick={() => copyText(getWebhookUrl(form.phoneNumber, form.webhookSecret), "Endpoint URL")}
                                        >
                                            คัดลอก
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                    <div className="tenant-form-group" style={{ marginBottom: 0 }}>
                                        <label className="tenant-form-label">Header Name</label>
                                        <div className="webhook-code-row">
                                            <code>Authorization</code>
                                            <button 
                                                type="button" 
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                onClick={() => copyText("Authorization", "Header Name")}
                                            >
                                                คัดลอก
                                            </button>
                                        </div>
                                    </div>
                                    <div className="tenant-form-group" style={{ marginBottom: 0 }}>
                                        <label className="tenant-form-label">Header Key</label>
                                        <div className="webhook-code-row">
                                            <code>{form.webhookSecret.trim() || "วาง Key ด้านบนก่อน"}</code>
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                disabled={!form.webhookSecret.trim()}
                                                onClick={() => copyText(form.webhookSecret.trim(), "Header Key")}
                                            >
                                                คัดลอก
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                                <button
                                    type="button"
                                    className="tenant-btn tenant-btn-secondary"
                                    style={{ flex: 1 }}
                                    onClick={() => setShowModal(false)}
                                >
                                    ยกเลิก
                                </button>
                                <button type="submit" className="tenant-btn tenant-btn-primary" style={{ flex: 1 }}>
                                    {editingId ? "บันทึก" : "เพิ่มวอลเล็ท"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Auto Withdraw Modal */}
            {showAutoWithdrawModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: 20
                    }}
                    onClick={() => setShowAutoWithdrawModal(false)}
                >
                    <div
                        className="tenant-card"
                        style={{ maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--theme-text-primary)", marginBottom: 24 }}>
                            ตั้งค่าโอนเงินอัตโนมัติ
                        </div>

                        <div className="tenant-form-group">
                            <label className="tenant-form-label">สถานะการทำงาน</label>
                            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={autoWithdrawForm.enabled}
                                    onChange={(e) => setAutoWithdrawForm({ ...autoWithdrawForm, enabled: e.target.checked })}
                                    style={{ width: 20, height: 20, accentColor: "var(--theme-accent)" }}
                                />
                                <span style={{ color: autoWithdrawForm.enabled ? "var(--theme-success)" : "var(--theme-text-muted)" }}>
                                    {autoWithdrawForm.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                                </span>
                            </label>
                        </div>

                        <div className="tenant-form-group">
                            <label className="tenant-form-label">เงื่อนไข (ยอดเงินขั้นต่ำ)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: "var(--theme-text-muted)" }}>เมื่อยอดเงินมากกว่า</span>
                                <input
                                    type="number"
                                    className="tenant-form-input"
                                    style={{ width: 120, textAlign: 'right' }}
                                    value={autoWithdrawForm.triggerMinBalance}
                                    onChange={(e) => setAutoWithdrawForm({ ...autoWithdrawForm, triggerMinBalance: Number(e.target.value) })}
                                />
                                <span style={{ color: "var(--theme-text-muted)" }}>บาท</span>
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--theme-text-muted)", marginTop: 6 }}>
                                * จะทำการโอนออกตามเงื่อนไขด้านล่าง เมื่อยอดถึงกำหนด
                            </div>
                        </div>

                        <div className="tenant-form-group">
                            <label className="tenant-form-label">เบอร์ปลายทางที่รับเงิน</label>
                            <input
                                type="text"
                                className="tenant-form-input"
                                value={autoWithdrawForm.targetNumber}
                                onChange={(e) => setAutoWithdrawForm({ ...autoWithdrawForm, targetNumber: e.target.value })}
                                placeholder="0xx-xxx-xxxx"
                            />
                        </div>

                        <div className="tenant-form-group">
                            <label className="tenant-form-label">รูปแบบการถอน</label>
                            <select
                                className="tenant-form-select"
                                value={autoWithdrawForm.withdrawType}
                                onChange={(e) => setAutoWithdrawForm({ ...autoWithdrawForm, withdrawType: e.target.value })}
                            >
                                <option value="ALL_EXCEPT">ถอนทั้งหมด (เหลือติดบัญชี)</option>
                                <option value="FIXED_AMOUNT">ถอนยอดคงที่ (ครั้งละ)</option>
                            </select>
                        </div>

                        {autoWithdrawForm.withdrawType === 'ALL_EXCEPT' && (
                            <div className="tenant-form-group">
                                <label className="tenant-form-label">เหลือเงินติดบัญชีไว้ (บาท)</label>
                                <input
                                    type="number"
                                    className="tenant-form-input"
                                    value={autoWithdrawForm.amountValue}
                                    onChange={(e) => setAutoWithdrawForm({ ...autoWithdrawForm, amountValue: Number(e.target.value) })}
                                />
                            </div>
                        )}

                        {autoWithdrawForm.withdrawType === 'FIXED_AMOUNT' && (
                            <div className="tenant-form-group">
                                <label className="tenant-form-label">จำนวนเงินที่ถอน (บาท)</label>
                                <input
                                    type="number"
                                    className="tenant-form-input"
                                    value={autoWithdrawForm.amountValue}
                                    onChange={(e) => setAutoWithdrawForm({ ...autoWithdrawForm, amountValue: Number(e.target.value) })}
                                />
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                            <button
                                type="button"
                                className="tenant-btn tenant-btn-secondary"
                                style={{ flex: 1 }}
                                onClick={() => setShowAutoWithdrawModal(false)}
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSaveAutoWithdraw}
                                className="tenant-btn tenant-btn-primary"
                                style={{ flex: 1 }}
                            >
                                บันทึกการตั้งค่า
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
