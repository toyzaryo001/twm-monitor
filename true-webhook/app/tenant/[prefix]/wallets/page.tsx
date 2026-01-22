"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Account {
    id: string;
    name: string;
    phoneNumber?: string;
    isActive: boolean;
    walletEndpointUrl: string;
}

export default function WalletsPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
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
            if (data.ok) setAccounts(data.data);
        } catch (e) {
            console.error("Error fetching accounts", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAccounts();
    }, [prefix]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = getToken();

        try {
            const res = await fetch(`/api/tenant/${prefix}/accounts`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(form),
            });
            const data = await res.json();

            if (!data.ok) {
                alert(data.error || "เกิดข้อผิดพลาด");
                return;
            }

            setShowModal(false);
            setForm({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "" });
            fetchAccounts();
        } catch (e) {
            alert("เกิดข้อผิดพลาด");
        }
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
        await fetch(`/api/tenant/${prefix}/accounts/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        fetchAccounts();
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
                <button className="tenant-btn tenant-btn-primary" onClick={() => setShowModal(true)}>
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
                            onClick={() => setShowModal(true)}
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
                                <div className="wallet-balance-value">฿ ---.--</div>
                            </div>

                            <div className="wallet-actions">
                                <button className="tenant-btn tenant-btn-success" style={{ flex: 1 }}>
                                    🔄 เช็คยอด
                                </button>
                                <button
                                    className="tenant-btn tenant-btn-secondary"
                                    onClick={() => handleToggle(account)}
                                >
                                    {account.isActive ? "⏸️" : "▶️"}
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
                        <div className="tenant-card-title" style={{ marginBottom: 24 }}>➕ เพิ่มวอลเล็ท TrueWallet</div>

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
                                    required
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
                                    ➕ เพิ่มวอลเล็ท
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
