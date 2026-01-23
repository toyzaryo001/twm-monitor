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

export default function AccountsPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "" });

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";

    const fetchAccounts = async () => {
        const res = await fetch(`/api/tenant/${prefix}/accounts`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.ok) setAccounts(data.data);
        setLoading(false);
    };

    useEffect(() => { fetchAccounts(); }, [prefix]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = editingId ? `/api/tenant/${prefix}/accounts/${editingId}` : `/api/tenant/${prefix}/accounts`;
        const method = editingId ? "PUT" : "POST";

        await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(form),
        });

        setShowModal(false);
        setEditingId(null);
        setForm({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "" });
        fetchAccounts();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("ยืนยันการลบบัญชี?")) return;
        await fetch(`/api/tenant/${prefix}/accounts/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        fetchAccounts();
    };

    const handleToggle = async (account: Account) => {
        await fetch(`/api/tenant/${prefix}/accounts/${account.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ isActive: !account.isActive }),
        });
        fetchAccounts();
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">จัดการบัญชี</h1>
                <button className="btn btn-primary" onClick={() => { setForm({ name: "", phoneNumber: "", walletEndpointUrl: "", walletBearerToken: "" }); setEditingId(null); setShowModal(true); }}>
                    + ผูกบัญชีใหม่
                </button>
            </div>

            <div className="card">
                {accounts.length === 0 ? (
                    <div className="empty-state">ยังไม่มีบัญชี TrueWallet</div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>ชื่อ</th>
                                <th>เบอร์โทร</th>
                                <th>สถานะ</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accounts.map((a) => (
                                <tr key={a.id}>
                                    <td>{a.name}</td>
                                    <td>{a.phoneNumber || "-"}</td>
                                    <td>
                                        <span className={`badge ${a.isActive ? "badge-success" : "badge-error"}`}>
                                            {a.isActive ? "ใช้งาน" : "ปิด"}
                                        </span>
                                    </td>
                                    <td style={{ display: "flex", gap: 8 }}>
                                        <button className="btn btn-secondary" style={{ padding: "8px 12px" }} onClick={() => handleToggle(a)}>
                                            {a.isActive ? "ปิด" : "เปิด"}
                                        </button>
                                        <button className="btn btn-danger" style={{ padding: "8px 12px" }} onClick={() => handleDelete(a.id)}>
                                            ลบ
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">ผูกบัญชี TrueWallet</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">ชื่อบัญชี</label>
                                <input type="text" className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">เบอร์โทร</label>
                                <input type="text" className="form-input" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Wallet Endpoint URL</label>
                                <input type="url" className="form-input" value={form.walletEndpointUrl} onChange={(e) => setForm({ ...form, walletEndpointUrl: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Bearer Token</label>
                                <input type="text" className="form-input" value={form.walletBearerToken} onChange={(e) => setForm({ ...form, walletBearerToken: e.target.value })} required />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary">ผูกบัญชี</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
