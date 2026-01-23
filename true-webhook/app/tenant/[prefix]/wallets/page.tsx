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
    const [form, setForm] = useState({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "" });

    const getToken = () => localStorage.getItem("tenantToken") || "";

    const fetchAccounts = async () => {
        const token = getToken();
        if (!token) return;

        try {
            const res = await fetch(`/api/tenant/${prefix}/accounts`, {
                headers: { Authorization: `Bearer ${token}` },
            });
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

    useEffect(() => {
        fetchAccounts();
    }, [prefix]);

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
            setForm({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "" });
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
                    setForm({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "" });
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
                                setForm({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "" });
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

                            <div className="wallet-actions">
                                <button
                                    className="tenant-btn tenant-btn-success"
                                    style={{ flex: 1 }}
                                    onClick={() => handleCheckBalance(account.id)}
                                    disabled={checkingId === account.id}
                                >
                                    {checkingId === account.id ? "⏳ กำลังเช็ค..." : "🔄 เช็คยอด"}
                                </button>
                                <button
                                    className="tenant-btn tenant-btn-secondary"
                                    onClick={() => handleToggle(account)}
                                >
                                    {account.isActive ? "⏸️" : "▶️"}
                                </button>
                                <button
                                    className="tenant-btn tenant-btn-secondary"
                                    onClick={() => handleEdit(account)}
                                >
                                    ✏️
                                </button>
                                <button
                                    className="tenant-btn tenant-btn-secondary"
                                    style={{ background: "rgba(239, 68, 68, 0.2)", color: "var(--error)" }}
                                    onClick={() => handleDelete(account.id)}
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
        </div>
    );
}
