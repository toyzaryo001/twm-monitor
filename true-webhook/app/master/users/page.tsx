"use client";

import { useEffect, useState } from "react";

interface User {
    id: string;
    email: string;
    displayName?: string;
    role: string;
    network?: { id: string; name: string; prefix: string };
}

interface Network {
    id: string;
    name: string;
    prefix: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [networks, setNetworks] = useState<Network[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ email: "", password: "", role: "NETWORK_ADMIN", networkId: "" });

    const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : "";

    const fetchData = async () => {
        const token = getToken();
        if (!token) return;

        try {
            const [usersRes, networksRes] = await Promise.all([
                fetch("/api/master/users", { headers: { Authorization: `Bearer ${token}` } }),
                fetch("/api/master/networks", { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            const usersData = await usersRes.json();
            const networksData = await networksRes.json();
            if (usersData.ok) setUsers(usersData.data);
            if (networksData.ok) setNetworks(networksData.data);
        } catch (e) {
            console.error("Error fetching data", e);
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = getToken();
        if (!token) return;

        // Validation for Network Admin
        if (form.role === "NETWORK_ADMIN" && !form.networkId) {
            alert("กรุณาเลือกเครือข่ายสำหรับ Super Admin");
            return;
        }

        const url = editingId ? `/api/master/users/${editingId}` : "/api/master/users";
        const method = editingId ? "PUT" : "POST";

        // Prepare body
        const body: any = {
            email: form.email,
            role: form.role,
            networkId: form.role === "MASTER" ? null : form.networkId,
            // Use username as display name if not editing or creating new
            displayName: form.email
        };

        if (form.password) {
            body.password = form.password;
        }

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (!data.ok) {
                alert(data.error || "เกิดข้อผิดพลาด");
                return;
            }

            setShowModal(false);
            setEditingId(null);
            setForm({ email: "", password: "", role: "NETWORK_ADMIN", networkId: "" });
            fetchData();
        } catch (e) {
            alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        }
    };

    const handleEdit = (user: User) => {
        setForm({
            email: user.email,
            password: "",
            role: user.role,
            networkId: user.network?.id || ""
        });
        setEditingId(user.id);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("ยืนยันการลบผู้ใช้?")) return;
        const token = getToken();
        await fetch(`/api/master/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        fetchData();
    };

    const getRoleLabel = (role: string) => {
        if (role === "MASTER") return "Master";
        if (role === "NETWORK_ADMIN") return "Super Admin";
        return role;
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">จัดการผู้ใช้</h1>
                <button className="btn btn-primary" onClick={() => {
                    setForm({ email: "", password: "", role: "NETWORK_ADMIN", networkId: "" });
                    setEditingId(null);
                    setShowModal(true);
                }}>
                    + เพิ่มผู้ใช้
                </button>
            </div>

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>บทบาท</th>
                            <th>เครือข่าย</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id}>
                                <td>{u.email}</td>
                                <td>
                                    <span className={`badge ${u.role === "MASTER" ? "badge-warning" : "badge-success"}`}>
                                        {getRoleLabel(u.role)}
                                    </span>
                                </td>
                                <td>{u.role === "MASTER" ? "ทุกเครือข่าย" : (u.network?.name || "-")}</td>
                                <td style={{ display: "flex", gap: 8 }}>
                                    <button className="btn btn-secondary" style={{ padding: "8px 12px" }} onClick={() => handleEdit(u)}>แก้ไข</button>
                                    <button className="btn btn-danger" style={{ padding: "8px 12px" }} onClick={() => handleDelete(u.id)}>ลบ</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">{editingId ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
                                    disabled={!!editingId} // Usually cannot change username once created
                                    placeholder="เช่น admin01"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">รหัสผ่าน {editingId && "(เว้นว่างหากไม่ต้องการเปลี่ยน)"}</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    minLength={editingId ? 0 : 6}
                                    required={!editingId}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">บทบาท</label>
                                <select
                                    className="form-input"
                                    value={form.role}
                                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                                >
                                    <option value="NETWORK_ADMIN">Super Admin (ดูแลเครือข่าย)</option>
                                    <option value="MASTER">Master (ดูแลระบบทั้งหมด)</option>
                                </select>
                            </div>

                            {form.role === "NETWORK_ADMIN" && (
                                <div className="form-group">
                                    <label className="form-label">เครือข่าย <span style={{ color: 'red' }}>*</span></label>
                                    <select
                                        className="form-input"
                                        value={form.networkId}
                                        onChange={(e) => setForm({ ...form, networkId: e.target.value })}
                                        required
                                    >
                                        <option value="">-- เลือกเครือข่าย --</option>
                                        {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary">{editingId ? "บันทึก" : "เพิ่ม"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
