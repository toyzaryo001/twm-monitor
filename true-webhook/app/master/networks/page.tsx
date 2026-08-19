"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "../../components/Toast";
import { masterFetch } from "../../lib/masterFetch";
import { ConfirmModal, EmptyState, PageHeader, StatCard, StatusBadge, TableShell } from "../components/MasterUI";

interface Network {
    id: string;
    prefix: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    expiredAt: string | null;
    totalBalance: number;
    _count: { users: number; accounts: number };
}

const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tmw-monitors.com";

export default function NetworksPage() {
    const { showToast } = useToast();
    const [networks, setNetworks] = useState<Network[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Network | null>(null);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [form, setForm] = useState({ prefix: "", name: "", adminUsername: "", adminPassword: "" });

    const fetchNetworks = async () => {
        try {
            const data = await masterFetch<{ ok: true; data: Network[] }>("/api/master/networks");
            setNetworks(data.data);
        } catch (error) {
            showToast({ type: "error", title: "โหลดข้อมูลไม่สำเร็จ", message: error instanceof Error ? error.message : "NETWORKS_LOAD_FAILED" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNetworks();
    }, []);

    const filteredNetworks = useMemo(() => {
        return networks.filter((network) => {
            const matchesText = `${network.name} ${network.prefix}`.toLowerCase().includes(query.trim().toLowerCase());
            const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? network.isActive : !network.isActive);
            return matchesText && matchesStatus;
        });
    }, [networks, query, statusFilter]);

    const totalBalance = networks.reduce((sum, network) => sum + (network.totalBalance || 0), 0);
    const expiredCount = networks.filter((network) => network.expiredAt && new Date(network.expiredAt) <= new Date()).length;

    const openCreate = () => {
        setForm({ prefix: "", name: "", adminUsername: "", adminPassword: "" });
        setEditingId(null);
        setShowModal(true);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const url = editingId ? `/api/master/networks/${editingId}` : "/api/master/networks";
        const method = editingId ? "PUT" : "POST";

        try {
            await masterFetch(url, {
                method,
                body: JSON.stringify({
                    ...form,
                    prefix: form.prefix.trim().toLowerCase(),
                    name: form.name.trim(),
                    adminUsername: form.adminUsername.trim(),
                }),
            });
            showToast({ type: "success", title: "บันทึกสำเร็จ", message: editingId ? "อัปเดตเครือข่ายแล้ว" : "สร้างเครือข่ายใหม่แล้ว" });
            setShowModal(false);
            setEditingId(null);
            await fetchNetworks();
        } catch (error) {
            showToast({ type: "error", title: "บันทึกไม่สำเร็จ", message: error instanceof Error ? error.message : "NETWORK_SAVE_FAILED" });
        }
    };

    const handleEdit = (network: Network) => {
        setForm({ prefix: network.prefix, name: network.name, adminUsername: "", adminPassword: "" });
        setEditingId(network.id);
        setShowModal(true);
    };

    const handleToggle = async (network: Network) => {
        try {
            await masterFetch(`/api/master/networks/${network.id}`, {
                method: "PUT",
                body: JSON.stringify({ isActive: !network.isActive }),
            });
            await fetchNetworks();
        } catch (error) {
            showToast({ type: "error", title: "เปลี่ยนสถานะไม่สำเร็จ", message: error instanceof Error ? error.message : "NETWORK_TOGGLE_FAILED" });
        }
    };

    const deleteNetwork = async () => {
        if (!confirmDelete) return;
        try {
            await masterFetch(`/api/master/networks/${confirmDelete.id}`, { method: "DELETE" });
            showToast({ type: "success", title: "เก็บเครือข่ายแล้ว", message: `${confirmDelete.name} ถูกปิดใช้งานโดยข้อมูลเดิมยังอยู่ครบ` });
            setConfirmDelete(null);
            await fetchNetworks();
        } catch (error) {
            showToast({ type: "error", title: "เก็บเครือข่ายไม่สำเร็จ", message: error instanceof Error ? error.message : "NETWORK_ARCHIVE_FAILED" });
        }
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <PageHeader
                eyebrow="Tenant Network"
                title="จัดการเครือข่าย"
                description="สร้าง tenant ใหม่ ตรวจยอดรวม เปิดปิดการใช้งาน และเข้าไปตั้งค่ารายเครือข่าย"
                actions={<button className="btn btn-primary" onClick={openCreate}>เพิ่มเครือข่าย</button>}
            />

            <div className="stats-grid">
                <StatCard label="เครือข่าย" value={networks.length} tone="gold" />
                <StatCard label="เปิดใช้งาน" value={networks.filter((item) => item.isActive).length} tone="green" />
                <StatCard label="หมดอายุ" value={expiredCount} tone={expiredCount > 0 ? "red" : "violet"} />
                <StatCard label="ยอดรวม" value={`฿${totalBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`} tone="cyan" />
            </div>

            <TableShell>
                <div style={{ padding: 18, borderBottom: "1px solid var(--border)", display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
                    <input className="form-input" style={{ maxWidth: 360 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อหรือ prefix" />
                    <select className="form-input" style={{ maxWidth: 190 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="all">ทุกสถานะ</option>
                        <option value="active">เปิดใช้งาน</option>
                        <option value="inactive">ปิดใช้งาน</option>
                    </select>
                </div>

                {filteredNetworks.length === 0 ? (
                    <EmptyState title="ไม่พบเครือข่าย" description="ลองเปลี่ยนคำค้นหาหรือสร้างเครือข่ายใหม่" action={<button className="btn btn-primary" onClick={openCreate}>เพิ่มเครือข่าย</button>} />
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>เครือข่าย</th>
                                    <th>ยอดรวม</th>
                                    <th>บัญชี</th>
                                    <th>อายุบริการ</th>
                                    <th>สถานะ</th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredNetworks.map((network) => {
                                    const expired = network.expiredAt ? new Date(network.expiredAt) <= new Date() : false;
                                    const daysLeft = network.expiredAt ? Math.ceil((new Date(network.expiredAt).getTime() - Date.now()) / 86400000) : null;
                                    return (
                                        <tr key={network.id}>
                                            <td>
                                                <div className="table-title">{network.name}</div>
                                                <div className="table-subtitle">
                                                    <code>{network.prefix}</code> {network.prefix}.{baseDomain}
                                                </div>
                                            </td>
                                            <td style={{ color: "var(--success)", fontWeight: 900 }}>
                                                ฿{(network.totalBalance || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                            </td>
                                            <td>{network._count.accounts}</td>
                                            <td>
                                                {network.expiredAt ? (
                                                    <span className={`badge ${expired ? "badge-error" : "badge-success"}`}>
                                                        {expired ? "หมดอายุ" : `${daysLeft} วัน`}
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-secondary">ไม่มีกำหนด</span>
                                                )}
                                            </td>
                                            <td><StatusBadge active={network.isActive} /></td>
                                            <td>
                                                <div className="table-actions">
                                                    <Link href={`/master/networks/${network.id}`} className="btn btn-primary btn-compact">ตั้งค่า</Link>
                                                    <button className="btn btn-secondary btn-compact" onClick={() => handleToggle(network)}>
                                                        {network.isActive ? "ปิด" : "เปิด"}
                                                    </button>
                                                    <button className="btn btn-secondary btn-compact" onClick={() => handleEdit(network)}>แก้ไข</button>
                                                    <button className="btn btn-danger btn-compact" onClick={() => setConfirmDelete(network)}>เก็บ</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </TableShell>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(event) => event.stopPropagation()}>
                        <h2 className="modal-title">{editingId ? "แก้ไขเครือข่าย" : "เพิ่มเครือข่าย"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Prefix</label>
                                    <input
                                        className="form-input"
                                        value={form.prefix}
                                        onChange={(event) => setForm({ ...form, prefix: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                                        placeholder="jga88"
                                        required
                                        disabled={!!editingId}
                                    />
                                    {!editingId && form.prefix && <div className="form-hint">https://{form.prefix}.{baseDomain}</div>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">ชื่อเครือข่าย</label>
                                    <input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="JGA88" />
                                </div>
                            </div>

                            {!editingId && (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Tenant Admin Username</label>
                                        <input className="form-input" value={form.adminUsername} onChange={(event) => setForm({ ...form, adminUsername: event.target.value })} placeholder="เว้นว่างได้" autoComplete="off" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tenant Admin Password</label>
                                        <input className="form-input" type="password" value={form.adminPassword} onChange={(event) => setForm({ ...form, adminPassword: event.target.value })} placeholder="อย่างน้อย 6 ตัวอักษร" autoComplete="new-password" />
                                    </div>
                                </div>
                            )}

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary">{editingId ? "บันทึก" : "สร้างเครือข่าย"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <ConfirmModal
                    title="เก็บเครือข่ายนี้?"
                    message={`ระบบจะปิดใช้งาน ${confirmDelete.name} และหยุดตรวจยอด โดยยังเก็บวอลเล็ตและประวัติทั้งหมดไว้`}
                    confirmText="เก็บและปิดใช้งาน"
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={deleteNetwork}
                />
            )}
        </div>
    );
}
