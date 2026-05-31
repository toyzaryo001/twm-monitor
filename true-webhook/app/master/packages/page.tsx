"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../components/Toast";
import { masterFetch } from "../../lib/masterFetch";
import { ConfirmModal, EmptyState, PageHeader, StatCard, StatusBadge, TableShell } from "../components/MasterUI";

interface Package {
    id: string;
    name: string;
    price: number;
    durationDays: number;
    description?: string;
    isActive: boolean;
    isRecommended: boolean;
}

const defaultForm = {
    name: "",
    price: "",
    durationDays: "30",
    description: "",
    isActive: true,
    isRecommended: false,
};

export default function PackagesPage() {
    const { showToast } = useToast();
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Package | null>(null);
    const [form, setForm] = useState(defaultForm);

    const fetchPackages = async () => {
        try {
            const data = await masterFetch<{ ok: true; data: Package[] }>("/api/master/packages");
            setPackages(data.data);
        } catch (error) {
            showToast({ type: "error", title: "โหลดแพ็คเกจไม่สำเร็จ", message: error instanceof Error ? error.message : "PACKAGES_LOAD_FAILED" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
    }, []);

    const resetForm = () => {
        setForm(defaultForm);
        setEditingId(null);
    };

    const handleEdit = (pkg: Package) => {
        setForm({
            name: pkg.name,
            price: String(pkg.price),
            durationDays: String(pkg.durationDays),
            description: pkg.description || "",
            isActive: pkg.isActive,
            isRecommended: pkg.isRecommended || false,
        });
        setEditingId(pkg.id);
        setShowModal(true);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const url = editingId ? `/api/master/packages/${editingId}` : "/api/master/packages";
        const method = editingId ? "PUT" : "POST";

        try {
            await masterFetch(url, {
                method,
                body: JSON.stringify({
                    name: form.name.trim(),
                    price: Number(form.price),
                    durationDays: Number(form.durationDays),
                    description: form.description.trim(),
                    isActive: form.isActive,
                    isRecommended: form.isRecommended,
                }),
            });
            showToast({ type: "success", title: "บันทึกสำเร็จ", message: "อัปเดตแพ็คเกจเรียบร้อยแล้ว" });
            setShowModal(false);
            resetForm();
            await fetchPackages();
        } catch (error) {
            showToast({ type: "error", title: "บันทึกไม่สำเร็จ", message: error instanceof Error ? error.message : "PACKAGE_SAVE_FAILED" });
        }
    };

    const deletePackage = async () => {
        if (!confirmDelete) return;
        try {
            await masterFetch(`/api/master/packages/${confirmDelete.id}`, { method: "DELETE" });
            showToast({ type: "success", title: "ลบสำเร็จ", message: `ลบแพ็คเกจ ${confirmDelete.name} แล้ว` });
            setConfirmDelete(null);
            await fetchPackages();
        } catch (error) {
            showToast({ type: "error", title: "ลบไม่สำเร็จ", message: error instanceof Error ? error.message : "PACKAGE_DELETE_FAILED" });
        }
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <PageHeader
                eyebrow="Pricing"
                title="จัดการแพ็คเกจ"
                description="กำหนดราคา ระยะเวลา และแพ็คเกจแนะนำที่ tenant ใช้ต่ออายุบริการ"
                actions={<button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>เพิ่มแพ็คเกจ</button>}
            />

            <div className="stats-grid">
                <StatCard label="แพ็คเกจทั้งหมด" value={packages.length} tone="gold" />
                <StatCard label="เปิดขาย" value={packages.filter((item) => item.isActive).length} tone="green" />
                <StatCard label="แพ็คเกจแนะนำ" value={packages.filter((item) => item.isRecommended).length} tone="cyan" />
            </div>

            <TableShell>
                {packages.length === 0 ? (
                    <EmptyState title="ยังไม่มีแพ็คเกจ" description="สร้างแพ็คเกจแรกเพื่อให้ tenant ต่ออายุบริการได้" />
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>แพ็คเกจ</th>
                                    <th>ราคา</th>
                                    <th>ระยะเวลา</th>
                                    <th>สถานะ</th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {packages.map((pkg) => (
                                    <tr key={pkg.id}>
                                        <td>
                                            <div className="table-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                {pkg.name}
                                                {pkg.isRecommended && <span className="badge badge-warning">แนะนำ</span>}
                                            </div>
                                            <div className="table-subtitle">{pkg.description || "ไม่มีรายละเอียด"}</div>
                                        </td>
                                        <td style={{ color: "var(--accent-gold)", fontWeight: 900 }}>฿{pkg.price.toLocaleString("th-TH")}</td>
                                        <td>{pkg.durationDays} วัน</td>
                                        <td><StatusBadge active={pkg.isActive} /></td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn btn-secondary btn-compact" onClick={() => handleEdit(pkg)}>แก้ไข</button>
                                                <button className="btn btn-danger btn-compact" onClick={() => setConfirmDelete(pkg)}>ลบ</button>
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
                        <h2 className="modal-title">{editingId ? "แก้ไขแพ็คเกจ" : "เพิ่มแพ็คเกจใหม่"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">ชื่อแพ็คเกจ</label>
                                <input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="เช่น PRO" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">ราคา (บาท)</label>
                                    <input className="form-input" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required min="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">จำนวนวัน</label>
                                    <input className="form-input" type="number" value={form.durationDays} onChange={(event) => setForm({ ...form, durationDays: event.target.value })} required min="1" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">รายละเอียด</label>
                                <textarea className="form-input" value={form.description} rows={3} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                            </div>
                            <div style={{ display: "grid", gap: 10 }}>
                                <label className="master-toggle-row">
                                    <span>เปิดใช้งานแพ็คเกจนี้</span>
                                    <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
                                </label>
                                <label className="master-toggle-row">
                                    <span>แสดงเป็นแพ็คเกจแนะนำ</span>
                                    <input type="checkbox" checked={form.isRecommended} onChange={(event) => setForm({ ...form, isRecommended: event.target.checked })} />
                                </label>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary">{editingId ? "บันทึก" : "สร้างแพ็คเกจ"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <ConfirmModal
                    title="ลบแพ็คเกจนี้?"
                    message={`ยืนยันการลบ ${confirmDelete.name}`}
                    confirmText="ลบแพ็คเกจ"
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={deletePackage}
                />
            )}
        </div>
    );
}
