"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../components/Toast";

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: "POPUP" | "MARQUEE";
    isActive: boolean;
    scope: "GLOBAL" | "SPECIFIC";
    targetNetworks: { id: string; name: string }[];
    createdAt: string;
}

interface Network {
    id: string;
    name: string;
    prefix: string;
}

export default function AnnouncementsPage() {
    const { showToast } = useToast();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [networks, setNetworks] = useState<Network[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState({
        title: "",
        content: "",
        type: "POPUP" as "POPUP" | "MARQUEE",
        isActive: true,
        networkIds: [] as string[]
    });

    const getToken = () => localStorage.getItem("token") || "";

    const fetchNetworks = async () => {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch("/api/master/networks", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) setNetworks(data.data);
        } catch (e) {
            console.error("Error fetching networks", e);
        }
    };

    const fetchAnnouncements = async () => {
        const token = getToken();
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch("/api/master/announcements", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) setAnnouncements(data.data);
        } catch (e) {
            console.error("Error fetching announcements", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchNetworks();
        fetchAnnouncements();
    }, []);

    const resetForm = () => {
        setForm({
            title: "",
            content: "",
            type: "POPUP",
            isActive: true,
            networkIds: []
        });
        setEditingId(null);
    };

    const handleEdit = (ann: Announcement) => {
        setForm({
            title: ann.title,
            content: ann.content,
            type: ann.type,
            isActive: ann.isActive,
            networkIds: ann.targetNetworks.map(n => n.id)
        });
        setEditingId(ann.id);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("ยืนยันการลบประกาศนี้?")) return;
        const token = getToken();
        try {
            await fetch(`/api/master/announcements/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAnnouncements();
        } catch (e) {
            showToast({ type: "error", title: "ล้มเหลว", message: "ลบประกาศไม่สำเร็จ" });
        }
    };

    const handleToggle = async (ann: Announcement) => {
        const token = getToken();
        try {
            await fetch(`/api/master/announcements/${ann.id}/toggle`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAnnouncements();
        } catch (e) {
            showToast({ type: "error", title: "ล้มเหลว", message: "เปลี่ยนสถานะไม่สำเร็จ" });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = getToken();
        const url = editingId
            ? `/api/master/announcements/${editingId}`
            : "/api/master/announcements";
        const method = editingId ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(form)
            });
            const data = await res.json();

            if (data.ok) {
                showToast({ type: "success", title: "สำเร็จ", message: "บันทึกข้อมูลเรียบร้อยแล้ว" });
                setShowModal(false);
                resetForm();
                fetchAnnouncements();
            } else {
                showToast({ type: "error", title: "ล้มเหลว", message: data.error || "เกิดข้อผิดพลาด" });
            }
        } catch (e) {
            showToast({ type: "error", title: "ล้มเหลว", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
        }
    };

    const toggleNetworkSelection = (id: string) => {
        setForm(prev => {
            if (prev.networkIds.includes(id)) {
                return { ...prev, networkIds: prev.networkIds.filter(nid => nid !== id) };
            } else {
                return { ...prev, networkIds: [...prev.networkIds, id] };
            }
        });
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">จัดการประกาศ</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    + เพิ่มประกาศ
                </button>
            </div>

            <div className="card">
                {announcements.length === 0 ? (
                    <div className="empty-state">ยังไม่มีประกาศ</div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>หัวข้อ</th>
                                <th>ประเภท</th>
                                <th>เป้าหมาย</th>
                                <th>สถานะ</th>
                                <th>วันที่สร้าง</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {announcements.map(ann => (
                                <tr key={ann.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{ann.title}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                            {ann.content.length > 50 ? ann.content.substring(0, 50) + "..." : ann.content}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${ann.type === "POPUP" ? "badge-primary" : "badge-secondary"}`}>
                                            {ann.type}
                                        </span>
                                    </td>
                                    <td>
                                        {ann.scope === "GLOBAL" ? (
                                            <span className="badge badge-success">ทุกเครือข่าย</span>
                                        ) : (
                                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 200 }}>
                                                {ann.targetNetworks.map(n => (
                                                    <span key={n.id} style={{ fontSize: 10, background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>
                                                        {n.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            className={`badge ${ann.isActive ? "badge-success" : "badge-error"}`}
                                            onClick={() => handleToggle(ann)}
                                            style={{ cursor: "pointer", border: "none" }}
                                        >
                                            {ann.isActive ? "แสดง" : "ซ่อน"}
                                        </button>
                                    </td>
                                    <td style={{ fontSize: 12 }}>
                                        {new Date(ann.createdAt).toLocaleDateString("th-TH")}
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => handleEdit(ann)}>
                                                แก้ไข
                                            </button>
                                            <button className="btn btn-danger" style={{ padding: "4px 8px" }} onClick={() => handleDelete(ann.id)}>
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
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <h2 className="modal-title">{editingId ? "แก้ไขประกาศ" : "เพิ่มประกาศใหม่"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">หัวข้อประกาศ</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    required
                                    placeholder="แจ้งเตือนการปิดปรับปรุง..."
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">เนื้อหา</label>
                                <textarea
                                    className="form-input"
                                    rows={4}
                                    value={form.content}
                                    onChange={e => setForm({ ...form, content: e.target.value })}
                                    required
                                    placeholder="รายละเอียด..."
                                    style={{ resize: "vertical" }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">ประเภท</label>
                                <div style={{ display: "flex", gap: 16 }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            name="type"
                                            checked={form.type === "POPUP"}
                                            onChange={() => setForm({ ...form, type: "POPUP" })}
                                        />
                                        <span>Popup (หน้าต่างเด้ง)</span>
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            name="type"
                                            checked={form.type === "MARQUEE"}
                                            onChange={() => setForm({ ...form, type: "MARQUEE" })}
                                        />
                                        <span>Marquee (ตัววิ่งด้านบน)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">เป้าหมาย (เลือกเครือข่าย)</label>
                                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, maxHeight: 150, overflowY: "auto" }}>
                                    <div style={{ marginBottom: 8, fontSize: 12, color: "var(--text-muted)" }}>
                                        * ไม่เลือกเลย = แสดงทุกเครือข่าย (Global)
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                        {networks.map(n => (
                                            <label key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={form.networkIds.includes(n.id)}
                                                    onChange={() => toggleNetworkSelection(n.id)}
                                                />
                                                <span>{n.name} <span style={{ color: "var(--text-muted)" }}>({n.prefix})</span></span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={e => setForm({ ...form, isActive: e.target.checked })}
                                    />
                                    <span>เปิดใช้งานทันที</span>
                                </label>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary">{editingId ? "บันทึกการแก้ไข" : "สร้างประกาศ"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
