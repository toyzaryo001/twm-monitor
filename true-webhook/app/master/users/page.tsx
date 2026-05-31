"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../components/Toast";
import { masterFetch } from "../../lib/masterFetch";
import { ConfirmModal, EmptyState, PageHeader, StatCard, TableShell } from "../components/MasterUI";

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

const defaultForm = { email: "", password: "", role: "NETWORK_ADMIN", networkId: "" };

export default function UsersPage() {
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [networks, setNetworks] = useState<Network[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
    const [form, setForm] = useState(defaultForm);

    const fetchData = async () => {
        try {
            const [usersData, networksData] = await Promise.all([
                masterFetch<{ ok: true; data: User[] }>("/api/master/users"),
                masterFetch<{ ok: true; data: Network[] }>("/api/master/networks"),
            ]);
            setUsers(usersData.data);
            setNetworks(networksData.data);
        } catch (error) {
            showToast({ type: "error", title: "โหลดข้อมูลไม่สำเร็จ", message: error instanceof Error ? error.message : "USERS_LOAD_FAILED" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (form.role === "NETWORK_ADMIN" && !form.networkId) {
            showToast({ type: "error", title: "ข้อมูลไม่ครบ", message: "กรุณาเลือกเครือข่ายสำหรับผู้ใช้ Network Admin" });
            return;
        }

        const body: any = {
            email: form.email.trim(),
            role: form.role,
            networkId: form.role === "MASTER" ? null : form.networkId,
            displayName: form.email.trim(),
        };
        if (form.password) body.password = form.password;

        try {
            await masterFetch(editingId ? `/api/master/users/${editingId}` : "/api/master/users", {
                method: editingId ? "PUT" : "POST",
                body: JSON.stringify(body),
            });
            showToast({ type: "success", title: "บันทึกสำเร็จ", message: editingId ? "แก้ไขผู้ใช้แล้ว" : "เพิ่มผู้ใช้แล้ว" });
            setShowModal(false);
            setEditingId(null);
            setForm(defaultForm);
            await fetchData();
        } catch (error) {
            showToast({ type: "error", title: "บันทึกไม่สำเร็จ", message: error instanceof Error ? error.message : "USER_SAVE_FAILED" });
        }
    };

    const handleEdit = (user: User) => {
        setForm({
            email: user.email,
            password: "",
            role: user.role,
            networkId: user.network?.id || "",
        });
        setEditingId(user.id);
        setShowModal(true);
    };

    const deleteUser = async () => {
        if (!confirmDelete) return;
        try {
            await masterFetch(`/api/master/users/${confirmDelete.id}`, { method: "DELETE" });
            showToast({ type: "success", title: "ลบสำเร็จ", message: `ลบ ${confirmDelete.email} แล้ว` });
            setConfirmDelete(null);
            await fetchData();
        } catch (error) {
            showToast({ type: "error", title: "ลบไม่สำเร็จ", message: error instanceof Error ? error.message : "USER_DELETE_FAILED" });
        }
    };

    const openCreate = () => {
        setForm(defaultForm);
        setEditingId(null);
        setShowModal(true);
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <PageHeader
                eyebrow="Access Control"
                title="จัดการผู้ใช้"
                description="ควบคุมบัญชี Master และ Network Admin ที่เข้าถึงระบบหลังบ้าน"
                actions={<button className="btn btn-primary" onClick={openCreate}>เพิ่มผู้ใช้</button>}
            />

            <div className="stats-grid">
                <StatCard label="ผู้ใช้ทั้งหมด" value={users.length} tone="gold" />
                <StatCard label="Master" value={users.filter((user) => user.role === "MASTER").length} tone="cyan" />
                <StatCard label="Network Admin" value={users.filter((user) => user.role === "NETWORK_ADMIN").length} tone="green" />
            </div>

            <TableShell>
                {users.length === 0 ? (
                    <EmptyState title="ยังไม่มีผู้ใช้" description="เพิ่มผู้ใช้เพื่อให้ทีมเข้าถึงระบบ" />
                ) : (
                    <div className="table-wrap">
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
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="table-title">{user.email}</div>
                                            <div className="table-subtitle">{user.displayName || "-"}</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${user.role === "MASTER" ? "badge-warning" : "badge-success"}`}>
                                                {user.role === "MASTER" ? "Master" : "Network Admin"}
                                            </span>
                                        </td>
                                        <td>{user.role === "MASTER" ? "ทุกเครือข่าย" : (user.network ? `${user.network.name} (${user.network.prefix})` : "-")}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn btn-secondary btn-compact" onClick={() => handleEdit(user)}>แก้ไข</button>
                                                <button className="btn btn-danger btn-compact" onClick={() => setConfirmDelete(user)}>ลบ</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </TableShell>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(event) => event.stopPropagation()}>
                        <h2 className="modal-title">{editingId ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input className="form-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required disabled={!!editingId} placeholder="admin01" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">รหัสผ่าน {editingId && "(เว้นว่างถ้าไม่เปลี่ยน)"}</label>
                                <input className="form-input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={editingId ? undefined : 6} required={!editingId} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">บทบาท</label>
                                    <select className="form-input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, networkId: event.target.value === "MASTER" ? "" : form.networkId })}>
                                        <option value="NETWORK_ADMIN">Network Admin</option>
                                        <option value="MASTER">Master</option>
                                    </select>
                                </div>
                                {form.role === "NETWORK_ADMIN" && (
                                    <div className="form-group">
                                        <label className="form-label">เครือข่าย</label>
                                        <select className="form-input" value={form.networkId} onChange={(event) => setForm({ ...form, networkId: event.target.value })} required>
                                            <option value="">เลือกเครือข่าย</option>
                                            {networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary">{editingId ? "บันทึก" : "เพิ่มผู้ใช้"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <ConfirmModal
                    title="ลบผู้ใช้นี้?"
                    message={`ยืนยันการลบ ${confirmDelete.email}`}
                    confirmText="ลบผู้ใช้"
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={deleteUser}
                />
            )}
        </div>
    );
}
