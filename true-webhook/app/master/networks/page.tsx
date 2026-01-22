"use client";

import { useEffect, useState } from "react";

interface Network {
    id: string;
    prefix: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    _count: { users: number; accounts: number };
}

export default function NetworksPage() {
    const [networks, setNetworks] = useState<Network[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ prefix: "", name: "" });

    const getToken = () => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("token") || "";
        }
        return "";
    };

    const fetchNetworks = async () => {
        const token = getToken();
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/master/networks", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.ok) setNetworks(data.data);
        } catch (e) {
            console.error("Error fetching networks:", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchNetworks();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = getToken();
        if (!token) return;

        const url = editingId ? `/api/master/networks/${editingId}` : "/api/master/networks";
        const method = editingId ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(form),
            });
            const data = await res.json();

            if (!data.ok) {
                alert(data.error || "เกิดข้อผิดพลาด");
                return;
            }
        } catch (e) {
            alert("เกิดข้อผิดพลาด");
            return;
        }

        setShowModal(false);
        setEditingId(null);
        setForm({ prefix: "", name: "" });
        fetchNetworks();
    };

    const handleEdit = (network: Network) => {
        setForm({ prefix: network.prefix, name: network.name });
        setEditingId(network.id);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("ยืนยันการลบเครือข่าย?")) return;
        const token = getToken();
        await fetch(`/api/master/networks/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        fetchNetworks();
    };

    const handleToggle = async (network: Network) => {
        const token = getToken();
        await fetch(`/api/master/networks/${network.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ isActive: !network.isActive }),
        });
        fetchNetworks();
    };

    if (loading) {
        return <div className="loading"><div className="spinner" /></div>;
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">จัดการเครือข่าย</h1>
                <button className="btn btn-primary" onClick={() => { setForm({ prefix: "", name: "" }); setEditingId(null); setShowModal(true); }}>
                    + เพิ่มเครือข่าย
                </button>
            </div>

            <div className="card">
                {networks.length === 0 ? (
                    <div className="empty-state">ยังไม่มีเครือข่าย</div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>ชื่อ</th>
                                <th>Prefix</th>
                                <th>ผู้ใช้</th>
                                <th>บัญชี</th>
                                <th>สถานะ</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {networks.map((n) => (
                                <tr key={n.id}>
                                    <td>{n.name}</td>
                                    <td><code>{n.prefix}</code></td>
                                    <td>{n._count.users}</td>
                                    <td>{n._count.accounts}</td>
                                    <td>
                                        <span className={`badge ${n.isActive ? "badge-success" : "badge-error"}`}>
                                            {n.isActive ? "ใช้งาน" : "ปิด"}
                                        </span>
                                    </td>
                                    <td style={{ display: "flex", gap: 8 }}>
                                        <button className="btn btn-secondary" style={{ padding: "8px 12px" }} onClick={() => handleToggle(n)}>
                                            {n.isActive ? "ปิด" : "เปิด"}
                                        </button>
                                        <button className="btn btn-secondary" style={{ padding: "8px 12px" }} onClick={() => handleEdit(n)}>
                                            แก้ไข
                                        </button>
                                        <button className="btn btn-danger" style={{ padding: "8px 12px" }} onClick={() => handleDelete(n.id)}>
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
                        <h2 className="modal-title">{editingId ? "แก้ไขเครือข่าย" : "เพิ่มเครือข่าย"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Prefix (ใช้ใน URL)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={form.prefix}
                                    onChange={(e) => setForm({ ...form, prefix: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                                    placeholder="shop1"
                                    required
                                    disabled={!!editingId}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">ชื่อเครือข่าย</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="ร้านค้า ABC"
                                    required
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    ยกเลิก
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingId ? "บันทึก" : "เพิ่ม"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
