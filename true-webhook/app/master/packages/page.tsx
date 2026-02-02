"use client";

import { useState, useEffect } from "react";
import { useToast } from "../../components/Toast";

interface Package {
    id: string;
    name: string;
    price: number;
    durationDays: number;
    description?: string;
    isActive: boolean;
    isRecommended: boolean;
}

export default function PackagesPage() {
    const { showToast } = useToast();
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        price: "",
        durationDays: "30",
        description: "",
        isActive: true,
        isRecommended: false
    });

    const getToken = () => localStorage.getItem("token") || "";

    const fetchPackages = async () => {
        const token = getToken();
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch("/api/master/packages", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) setPackages(data.data);
        } catch (e) {
            console.error("Error fetching packages", e);
        }
        setLoading(false);
    };

    useEffect(() => { fetchPackages(); }, []);

    const resetForm = () => {
        setForm({ name: "", price: "", durationDays: "30", description: "", isActive: true, isRecommended: false });
        setEditingId(null);
    };

    const handleEdit = (pkg: Package) => {
        setForm({
            name: pkg.name,
            price: String(pkg.price),
            durationDays: String(pkg.durationDays),
            description: pkg.description || "",
            isActive: pkg.isActive,
            isRecommended: pkg.isRecommended || false
        });
        setEditingId(pkg.id);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("ยืนยันการลบแพ็คเกจนี้?")) return;
        const token = getToken();
        try {
            await fetch(`/api/master/packages/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast({ type: "success", title: "สำเร็จ", message: "ลบแพ็คเกจเรียบร้อยแล้ว" });
            fetchPackages();
        } catch (e) {
            showToast({ type: "error", title: "ล้มเหลว", message: "ลบแพ็คเกจไม่สำเร็จ" });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = getToken();
        const url = editingId ? `/api/master/packages/${editingId}` : "/api/master/packages";
        const method = editingId ? "PUT" : "POST";

        const payload = {
            name: form.name,
            price: Number(form.price),
            durationDays: Number(form.durationDays),
            description: form.description,
            isActive: form.isActive,
            isRecommended: form.isRecommended
        };

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.ok) {
                showToast({ type: "success", title: "สำเร็จ", message: "บันทึกข้อมูลเรียบร้อยแล้ว" });
                setShowModal(false);
                resetForm();
                fetchPackages();
            } else {
                showToast({ type: "error", title: "ล้มเหลว", message: data.error || "เกิดข้อผิดพลาด" });
            }
        } catch (e) {
            showToast({ type: "error", title: "ล้มเหลว", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
        }
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">จัดการแพ็คเกจ</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    + เพิ่มแพ็คเกจ
                </button>
            </div>

            <div className="card">
                {packages.length === 0 ? (
                    <div className="empty-state">ยังไม่มีแพ็คเกจ</div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>ชื่อแพ็คเกจ</th>
                                <th>ราคา</th>
                                <th>ระยะเวลา</th>
                                <th>สถานะ</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packages.map(pkg => (
                                <tr key={pkg.id}>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <div style={{ fontWeight: 600 }}>{pkg.name}</div>
                                            {pkg.isRecommended && (
                                                <span style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>แนะนำ</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                            {pkg.description ? (pkg.description.length > 40 ? pkg.description.substring(0, 40) + "..." : pkg.description) : "-"}
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ color: "var(--primary)", fontWeight: 700, fontSize: 16 }}>
                                            ฿{pkg.price.toLocaleString()}
                                        </span>
                                    </td>
                                    <td>{pkg.durationDays} วัน</td>
                                    <td>
                                        <span className={`badge ${pkg.isActive ? "badge-success" : "badge-error"}`}>
                                            {pkg.isActive ? "เปิดใช้" : "ปิดใช้"}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => handleEdit(pkg)}>
                                                แก้ไข
                                            </button>
                                            <button className="btn btn-danger" style={{ padding: "4px 8px" }} onClick={() => handleDelete(pkg.id)}>
                                                ลบ
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <h2 className="modal-title">{editingId ? "แก้ไขแพ็คเกจ" : "เพิ่มแพ็คเกจใหม่"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">ชื่อแพ็คเกจ</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    required
                                    placeholder="เช่น Silver, Gold, Premium"
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">ราคา (บาท)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={form.price}
                                        onChange={e => setForm({ ...form, price: e.target.value })}
                                        required
                                        min="0"
                                        placeholder="1500"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">จำนวนวัน</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={form.durationDays}
                                        onChange={e => setForm({ ...form, durationDays: e.target.value })}
                                        required
                                        min="1"
                                        placeholder="30"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">รายละเอียด</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="รายละเอียดฟีเจอร์..."
                                    style={{ resize: "vertical" }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={e => setForm({ ...form, isActive: e.target.checked })}
                                    />
                                    <span>เปิดใช้งาน</span>
                                </label>
                            </div>

                            <div className="form-group">
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={form.isRecommended}
                                        onChange={e => setForm({ ...form, isRecommended: e.target.checked })}
                                    />
                                    <span>⭐ แสดงป้าย "แนะนำ"</span>
                                </label>
                                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                    แพ็คเกจที่เลือกจะแสดงป้ายสีส้ม "แนะนำ" ให้ลูกค้าเห็น
                                </p>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary">{editingId ? "บันทึกการแก้ไข" : "สร้างแพ็คเกจ"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
