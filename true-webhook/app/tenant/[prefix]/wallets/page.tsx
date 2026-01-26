"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "../../../components/Toast";

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
}

interface BalanceData {
    balance: number;
    checkedAt: string;
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
    const [form, setForm] = useState({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "", webhookSecret: "" });

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = getToken();

        const url = editingId ? `/api/tenant/${prefix}/accounts/${editingId}` : `/api/tenant/${prefix}/accounts`;
        const method = editingId ? "PUT" : "POST";

        // Prepare payload, remove empty token if editing
        const payload: any = { ...form };
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
            setForm({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "", webhookSecret: "" });
            fetchAccounts();
        } catch (e) {
            showToast({ type: "error", title: "ล้มเหลว", message: "เกิดข้อผิดพลาดในการบันทึก" });
        }
    };

    const handleEdit = (account: Account) => {
        setForm({
            name: account.name,
            phoneNumber: account.phoneNumber || "",
            walletEndpointUrl: account.walletEndpointUrl,
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
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            <div className="tenant-page-header">
                <h1 className="tenant-page-title">จัดการวอลเล็ท</h1>
                <button className="tenant-btn tenant-btn-primary" onClick={() => {
                    setForm({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "", webhookSecret: "" });
                    setEditingId(null);
                    setShowModal(true);
                }}>
                    ➕ เพิ่มวอลเล็ท
                </button>
            </div>

            {accounts.length === 0 ? (
                <div className="tenant-card">
                    <div className="tenant-empty">
                        <div className="tenant-empty-icon">💳</div>
                        <div className="tenant-empty-text">ยังไม่มีวอลเล็ท</div>
                        <button
                            className="tenant-btn tenant-btn-primary"
                            style={{ marginTop: 16 }}
                            onClick={() => {
                                setForm({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "", webhookSecret: "" });
                                setEditingId(null);
                                setShowModal(true);
                            }}
                        >
                            ➕ เพิ่มวอลเล็ทแรก
                        </button>
                    </div>
                </div>
            ) : (
                <div className="wallet-grid">
                    {accounts.map((account) => (
                        <div key={account.id} className="wallet-card">
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
                                <div className="wallet-balance-value">
                                    {balances[account.id]
                                        ? `฿ ${balances[account.id]!.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                                        : "฿ ---.--"}
                                </div>
                                {balances[account.id] && (
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                        อัพเดท: {new Date(balances[account.id]!.checkedAt).toLocaleString("th-TH")}
                                    </div>
                                )}
                            </div>

                            {/* Wallet Stats Footer */}
                            <div style={{
                                marginTop: 16,
                                marginBottom: 16,
                                padding: "12px",
                                background: "rgba(0,0,0,0.2)",
                                borderRadius: "8px",
                                border: "1px dashed var(--tenant-border)"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: 13 }}>📖</span>
                                        <span style={{ fontSize: 11, color: "var(--tenant-text-muted)" }}>ค่าธรรมเนียม:</span>
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tenant-error)" }}>
                                        ฿ {(account.stats?.totalFee || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: 13 }}>⏱️</span>
                                        <span style={{ fontSize: 11, color: "var(--tenant-text-muted)" }}>เริ่มนับ:</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: "var(--tenant-text-muted)" }}>
                                        {(account.stats?.totalFee || 0) > 0 && account.stats?.firstActiveAt
                                            ? new Date(account.stats.firstActiveAt).toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: '2-digit' })
                                            : "-- -- --"
                                        }
                                    </span>
                                </div>
                            </div>

                            <div className="wallet-actions">
                                <button
                                    className="tenant-btn tenant-btn-success tenant-btn-sm"
                                    style={{ flex: 1, padding: "6px 2px", fontSize: "0.7rem", whiteSpace: "nowrap" }}
                                    onClick={() => handleCheckBalance(account.id)}
                                    disabled={checkingId === account.id}
                                >
                                    {checkingId === account.id ? "⏳" : "🔄 เช็คยอด"}
                                </button>
                                {featureAutoWithdrawEnabled && (
                                    <button
                                        className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                        onClick={() => handleOpenAutoWithdraw(account)}
                                        title="ตั้งค่าโอนอัตโนมัติ"
                                        style={{ padding: "6px 2px", fontSize: "0.7rem" }}
                                    >
                                        ⚙️ Auto
                                    </button>
                                )}
                                <button
                                    className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                    onClick={() => handleToggle(account)}
                                    title={account.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                >
                                    {account.isActive ? "⏸️" : "▶️"}
                                </button>
                                <button
                                    className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                    onClick={() => handleEdit(account)}
                                    title="แก้ไข"
                                >
                                    ✏️
                                </button>
                                <button
                                    className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                    style={{ background: "rgba(239, 68, 68, 0.2)", color: "var(--error)" }}
                                    onClick={() => handleDelete(account.id)}
                                    title="ลบ"
                                >
                                    🗑️
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
                        background: "rgba(0,0,0,0.7)",
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
                        style={{ maxWidth: 480, width: "100%" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="tenant-card-title" style={{ marginBottom: 24 }}>
                            {editingId ? "✏️ แก้ไขวอลเล็ท" : "➕ เพิ่มวอลเล็ท TrueWallet"}
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
                                <label className="tenant-form-label">Wallet API Endpoint</label>
                                <input
                                    type="url"
                                    className="tenant-form-input"
                                    value={form.walletEndpointUrl}
                                    onChange={(e) => setForm({ ...form, walletEndpointUrl: e.target.value })}
                                    placeholder="https://api.example.com/wallet"
                                    required
                                />
                            </div>

                            <div className="tenant-form-group">
                                <label className="tenant-form-label">Bearer Token</label>
                                <input
                                    type="text"
                                    className="tenant-form-input"
                                    value={form.walletBearerToken}
                                    onChange={(e) => setForm({ ...form, walletBearerToken: e.target.value })}
                                    placeholder="API Token"
                                    required={!editingId}
                                />
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
                                    {editingId ? "บันทึก" : "➕ เพิ่มวอลเล็ท"}
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
                        background: "rgba(0,0,0,0.7)",
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
                        style={{ maxWidth: 480, width: "100%" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="tenant-card-title" style={{ marginBottom: 24 }}>
                            ⚙️ ตั้งค่าโอนเงินอัตโนมัติ (Auto Withdraw)
                        </div>

                        <div className="tenant-form-group">
                            <label className="tenant-form-label">สถานะการทำงาน</label>
                            <label className="switch" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={autoWithdrawForm.enabled}
                                    onChange={(e) => setAutoWithdrawForm({ ...autoWithdrawForm, enabled: e.target.checked })}
                                    style={{ width: 20, height: 20 }}
                                />
                                <span style={{ color: autoWithdrawForm.enabled ? "var(--success)" : "var(--text-muted)" }}>
                                    {autoWithdrawForm.enabled ? "เปิดใช้งาน" : "ปิด"}
                                </span>
                            </label>
                        </div>

                        <div className="tenant-form-group">
                            <label className="tenant-form-label">เงื่อนไข (ยอดเงินขั้นต่ำ)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: "var(--text-muted)" }}>เมื่อยอดเงินมากกว่า</span>
                                <input
                                    type="number"
                                    className="tenant-form-input"
                                    style={{ width: 120, textAlign: 'right' }}
                                    value={autoWithdrawForm.triggerMinBalance}
                                    onChange={(e) => setAutoWithdrawForm({ ...autoWithdrawForm, triggerMinBalance: Number(e.target.value) })}
                                />
                                <span style={{ color: "var(--text-muted)" }}>บาท</span>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                * จะทำการโอนออกจนเหลือ 0 (หรือตามที่กำหนด) เมื่อยอดถึงกำหนด
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
                                className="tenant-form-input"
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
