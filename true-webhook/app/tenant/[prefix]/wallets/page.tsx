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
    walletBearerToken?: string;
    stats?: {
        totalFee: number;
        firstActiveAt: string | null;
    };
    webhookSecret?: string | null;
    webhookSecretConfigured?: boolean;
}

function maskSecretKey(value?: string | null): string {
    if (!value) return "";
    const clean = value.trim();
    if (clean.length <= 8) {
        return clean.length >= 4 ? `${clean.slice(0, 2)}****${clean.slice(-2)}` : "********";
    }
    return `${clean.slice(0, 4)}**********${clean.slice(-4)}`;
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
    const [showFullBearer, setShowFullBearer] = useState(false);
    const [showFullSecret, setShowFullSecret] = useState(false);
    const [editingBearerField, setEditingBearerField] = useState(false);
    const [editingSecretField, setEditingSecretField] = useState(false);
    const [originalBearerToken, setOriginalBearerToken] = useState("");
    const [originalWebhookSecret, setOriginalWebhookSecret] = useState("");

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

        // Prepare payload
        const payload: any = {
            name: form.name.trim(),
            phoneNumber: form.phoneNumber.trim(),
            walletEndpointUrl: TRUE_MONEY_BALANCE_ENDPOINT
        };

        if (!editingId) {
            payload.walletBearerToken = form.walletBearerToken.trim();
            if (form.webhookSecret.trim()) {
                payload.webhookSecret = form.webhookSecret.trim();
            }
        } else {
            // Only send new token if explicitly changed and not containing mask asterisks
            if (editingBearerField && form.walletBearerToken.trim() && !form.walletBearerToken.includes("**********")) {
                payload.walletBearerToken = form.walletBearerToken.trim();
            }
            if (editingSecretField) {
                const cleanSecret = form.webhookSecret.trim();
                if (!cleanSecret.includes("**********")) {
                    payload.webhookSecret = cleanSecret || null;
                }
            }
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
        const bearer = account.walletBearerToken || "";
        const secret = account.webhookSecret || "";
        setForm({
            name: account.name,
            phoneNumber: account.phoneNumber || "",
            walletEndpointUrl: TRUE_MONEY_BALANCE_ENDPOINT,
            walletBearerToken: bearer,
            webhookSecret: secret,
        });
        setOriginalBearerToken(bearer);
        setOriginalWebhookSecret(secret);
        setShowFullBearer(false);
        setShowFullSecret(false);
        setEditingBearerField(!bearer);
        setEditingSecretField(!secret);
        setEditingId(account.id);
        setShowModal(true);
    };

    const handleOpenAddModal = () => {
        setForm(createEmptyWalletForm());
        setOriginalBearerToken("");
        setOriginalWebhookSecret("");
        setShowFullBearer(false);
        setShowFullSecret(false);
        setEditingBearerField(true);
        setEditingSecretField(true);
        setEditingId(null);
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

    const getWebhookUrl = () => {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        return `${origin}/api/webhook/${prefix}`;
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
                <button className="tenant-btn tenant-btn-primary" onClick={handleOpenAddModal}>
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
                        onClick={handleOpenAddModal}
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

            {/* Add / Edit Wallet Modal (Modern & User Friendly) */}
            {showModal && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.75)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: 16
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="tenant-card"
                        style={{
                            maxWidth: 620,
                            width: "100%",
                            maxHeight: "92vh",
                            overflowY: "auto",
                            borderRadius: 16,
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
                            padding: 28,
                            position: "relative"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                            <div>
                                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--theme-text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: "1.3rem" }}>{editingId ? "⚙️" : "✨"}</span>
                                    {editingId ? "แก้ไขข้อมูลวอลเล็ท" : "เพิ่มวอลเล็ท TrueMoney"}
                                </div>
                                <div style={{ fontSize: "0.85rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                                    {editingId ? "แก้ไขและตรวจสอบคีย์เชื่อมต่อของวอลเล็ทนี้" : "เชื่อมต่อบัญชี TrueMoney เพื่อรับ Webhook และเช็คยอดคงเหลือ"}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--theme-text-muted)",
                                    fontSize: "1.2rem",
                                    cursor: "pointer",
                                    padding: "4px 8px",
                                    borderRadius: 6
                                }}
                                title="ปิดหน้าต่าง"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Section 1: ข้อมูลบัญชีวอลเล็ท */}
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--theme-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                                    <span>📱</span> ข้อมูลบัญชีวอลเล็ท
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                                    <div className="tenant-form-group" style={{ marginBottom: 0 }}>
                                        <label className="tenant-form-label">ชื่อวอลเล็ท <span style={{ color: "var(--theme-danger, #ef4444)" }}>*</span></label>
                                        <input
                                            type="text"
                                            className="tenant-form-input"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="เช่น บัญชีรับโอน 1"
                                            required
                                        />
                                    </div>
                                    <div className="tenant-form-group" style={{ marginBottom: 0 }}>
                                        <label className="tenant-form-label">เบอร์โทรศัพท์ TrueMoney</label>
                                        <input
                                            type="text"
                                            className="tenant-form-input"
                                            value={form.phoneNumber}
                                            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                                            placeholder="08x-xxx-xxxx"
                                        />
                                    </div>
                                </div>

                                {/* Balance Bearer Token */}
                                <div className="tenant-form-group" style={{ marginBottom: 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                        <label className="tenant-form-label" style={{ marginBottom: 0 }}>
                                            Balance Bearer Token <span style={{ fontSize: "0.75rem", color: "var(--theme-text-muted)", fontWeight: 400 }}>(สำหรับเช็คยอดเงิน)</span>
                                        </label>
                                        {originalBearerToken && !editingBearerField && (
                                            <span className="badge badge-success" style={{ fontSize: "10px", padding: "2px 6px" }}>
                                                ผูกคีย์ไว้แล้ว
                                            </span>
                                        )}
                                    </div>

                                    {originalBearerToken && !editingBearerField ? (
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            background: "rgba(255, 255, 255, 0.04)",
                                            border: "1px solid var(--theme-border-subtle)",
                                            borderRadius: 8,
                                            padding: "6px 10px",
                                            gap: 8
                                        }}>
                                            <code style={{
                                                flex: 1,
                                                fontFamily: "ui-monospace, monospace",
                                                fontSize: "0.95rem",
                                                color: "var(--theme-text-primary)",
                                                letterSpacing: "0.5px"
                                            }}>
                                                {showFullBearer ? form.walletBearerToken : maskSecretKey(form.walletBearerToken)}
                                            </code>
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                onClick={() => setShowFullBearer(!showFullBearer)}
                                                title={showFullBearer ? "ซ่อนคีย์" : "แสดงคีย์เต็ม"}
                                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                            >
                                                {showFullBearer ? "ซ่อน" : "👁️ แสดง"}
                                            </button>
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                onClick={() => copyText(form.walletBearerToken, "Bearer Token")}
                                                title="คัดลอก Token เต็ม"
                                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                            >
                                                📋 คัดลอก
                                            </button>
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                onClick={() => {
                                                    setEditingBearerField(true);
                                                    setForm(prev => ({ ...prev, walletBearerToken: "" }));
                                                }}
                                                title="ใส่ Token ใหม่"
                                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                            >
                                                ✏️ เปลี่ยน
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <input
                                                type="text"
                                                className="tenant-form-input"
                                                value={form.walletBearerToken}
                                                onChange={(e) => setForm({ ...form, walletBearerToken: e.target.value })}
                                                placeholder={editingId ? "วาง Token ใหม่ที่นี่" : "วาง Bearer Token สำหรับเช็คยอดเงิน"}
                                                required={!editingId}
                                                style={{ fontFamily: "monospace", fontSize: "0.95rem" }}
                                            />
                                            {editingId && originalBearerToken && (
                                                <button
                                                    type="button"
                                                    className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                    onClick={() => {
                                                        setEditingBearerField(false);
                                                        setForm(prev => ({ ...prev, walletBearerToken: originalBearerToken }));
                                                    }}
                                                    title="ยกเลิกการเปลี่ยน ใช้คีย์เดิม"
                                                >
                                                    ยกเลิก
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div style={{ fontSize: "0.78rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                                        * คีย์นี้ใช้เช็คยอดคงเหลืออัตโนมัติ (แสดง 4 ตัวหน้า-หลัง ปลอดภัยในการใช้งาน)
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: ขั้นตอนการผูก Webhook กับแอป TrueMoney */}
                            <div style={{
                                background: "rgba(255, 255, 255, 0.025)",
                                padding: 18,
                                borderRadius: 12,
                                border: "1px solid var(--theme-border-subtle)",
                                marginBottom: 24
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: "var(--theme-text-primary)", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 6 }}>
                                            <span>🚀</span> ขั้นตอนการผูก Webhook ในแอป TrueMoney
                                        </div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--theme-text-muted)", marginTop: 2 }}>
                                            ทำตาม 2 ขั้นตอนด้านล่างเพื่อเชื่อมต่อรับแจ้งเตือนเงินเข้าและหักค่าธรรมเนียม
                                        </div>
                                    </div>
                                    <span className={`badge ${form.webhookSecret.trim() ? "badge-success" : "badge-neutral"}`} style={{ fontSize: "11px" }}>
                                        {form.webhookSecret.trim() ? "พร้อมใช้งาน" : "รอนำ Key มาวาง"}
                                    </span>
                                </div>

                                {/* Step 1: คัดลอกลิงก์ไปวาง */}
                                <div className="tenant-form-group" style={{ marginBottom: 16 }}>
                                    <label className="tenant-form-label" style={{ fontSize: "0.84rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                        <span>1.</span> คัดลอกลิงก์ Endpoint URL ไปวางในแอป TrueMoney
                                    </label>
                                    <div className="webhook-code-row">
                                        <code style={{ fontSize: "0.88rem", overflowX: "auto" }}>
                                            {getWebhookUrl()}
                                        </code>
                                        <button
                                            type="button"
                                            className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                            onClick={() => copyText(getWebhookUrl(), "Endpoint URL")}
                                        >
                                            📋 คัดลอกลิงก์
                                        </button>
                                    </div>
                                </div>

                                {/* Step 2: นำ Webhook Header Key จากหน้าแอปกลับมาวาง */}
                                <div className="tenant-form-group" style={{ marginBottom: 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                        <label className="tenant-form-label" style={{ fontSize: "0.84rem", fontWeight: 600, marginBottom: 0, display: "flex", alignItems: "center", gap: 6 }}>
                                            <span>2.</span> นำ Webhook Header Key (Authorization Secret) จากหน้าแอปกลับมาวาง
                                        </label>
                                        {originalWebhookSecret && !editingSecretField && (
                                            <span className="badge badge-success" style={{ fontSize: "10px", padding: "2px 6px" }}>
                                                ผูกคีย์ไว้แล้ว
                                            </span>
                                        )}
                                    </div>

                                    {originalWebhookSecret && !editingSecretField ? (
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            background: "rgba(255, 255, 255, 0.04)",
                                            border: "1px solid var(--theme-border-subtle)",
                                            borderRadius: 8,
                                            padding: "6px 10px",
                                            gap: 8
                                        }}>
                                            <code style={{
                                                flex: 1,
                                                fontFamily: "ui-monospace, monospace",
                                                fontSize: "0.95rem",
                                                color: "var(--theme-text-primary)",
                                                letterSpacing: "0.5px"
                                            }}>
                                                {showFullSecret ? form.webhookSecret : maskSecretKey(form.webhookSecret)}
                                            </code>
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                onClick={() => setShowFullSecret(!showFullSecret)}
                                                title={showFullSecret ? "ซ่อนคีย์" : "แสดงคีย์เต็ม"}
                                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                            >
                                                {showFullSecret ? "ซ่อน" : "👁️ แสดง"}
                                            </button>
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                onClick={() => copyText(form.webhookSecret, "Webhook Header Key")}
                                                title="คัดลอก Key เต็ม"
                                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                            >
                                                📋 คัดลอก
                                            </button>
                                            <button
                                                type="button"
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                onClick={() => {
                                                    setEditingSecretField(true);
                                                    setForm(prev => ({ ...prev, webhookSecret: "" }));
                                                }}
                                                title="ใส่ Key ใหม่"
                                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                            >
                                                ✏️ เปลี่ยน
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <input
                                                type="text"
                                                className="tenant-form-input"
                                                value={form.webhookSecret}
                                                onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                                                placeholder="วาง Webhook Header Key ที่ได้จากหน้าแอป TrueMoney"
                                                style={{ fontFamily: "monospace", fontSize: "0.95rem" }}
                                            />
                                            {editingId && originalWebhookSecret && (
                                                <button
                                                    type="button"
                                                    className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                    onClick={() => {
                                                        setEditingSecretField(false);
                                                        setForm(prev => ({ ...prev, webhookSecret: originalWebhookSecret }));
                                                    }}
                                                    title="ใช้คีย์เดิม"
                                                >
                                                    ยกเลิก
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div style={{ fontSize: "0.78rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                                        * ระบบตรวจจับ Header Name เป็น <code>Authorization</code> โดยอัตโนมัติ ไม่จำเป็นต้องระบุชื่อ Header เพิ่มเติม
                                    </div>
                                </div>
                            </div>

                            {/* Modal Action Buttons */}
                            <div style={{ display: "flex", gap: 12 }}>
                                <button
                                    type="button"
                                    className="tenant-btn tenant-btn-secondary"
                                    style={{ flex: 1 }}
                                    onClick={() => setShowModal(false)}
                                >
                                    ยกเลิก
                                </button>
                                <button type="submit" className="tenant-btn tenant-btn-primary" style={{ flex: 1 }}>
                                    {editingId ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มวอลเล็ท"}
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
