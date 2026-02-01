"use client";

import { useState, useEffect } from "react";
import { ToastProvider, useToast } from "../../components/Toast";
import Link from "next/link";

interface Package {
    id: string;
    name: string;
    price: number;
    durationDays: number;
    description?: string;
    isActive: boolean;
}

function PackagesContent() {
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const { showToast } = useToast();

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        price: "",
        durationDays: "30",
        description: ""
    });
    const [editId, setEditId] = useState<string | null>(null);

    const fetchPackages = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/master/packages", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) {
                setPackages(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem("token");

        const payload = {
            name: formData.name,
            price: Number(formData.price),
            durationDays: Number(formData.durationDays),
            description: formData.description
        };

        try {
            const url = editId ? `/api/master/packages/${editId}` : "/api/master/packages";
            const method = editId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.ok) {
                showToast({ title: editId ? "แก้ไขแพ็คเกจสำเร็จ" : "สร้างแพ็คเกจสำเร็จ", type: "success" });
                setShowModal(false);
                setFormData({ name: "", price: "", durationDays: "30", description: "" });
                setEditId(null);
                fetchPackages();
            } else {
                showToast({ title: result.error || "เกิดข้อผิดพลาด", type: "error" });
            }
        } catch (err) {
            showToast({ title: "Failed to save package", type: "error" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("ยืนยันการลบแพ็คเกจ?")) return;
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/api/master/packages/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                showToast({ title: "ลบแพ็คเกจสำเร็จ", type: "success" });
                fetchPackages();
            }
        } catch (err) {
            showToast({ title: "Error deleting package", type: "error" });
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">จัดการแพ็คเกจ</h1>
                    <p className="text-gray-400">กำหนดราคาและระยะเวลาสำหรับบริการ</p>
                </div>
                <button
                    onClick={() => {
                        setEditId(null);
                        setFormData({ name: "", price: "", durationDays: "30", description: "" });
                        setShowModal(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                    <span>+ เพิ่มแพ็คเกจ</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {packages.map(pkg => (
                        <div key={pkg.id} className="bg-[#1e1e1e] border border-[#333] rounded-xl p-6 relative group hover:border-indigo-500 transition-colors">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button
                                    onClick={() => {
                                        setEditId(pkg.id);
                                        setFormData({
                                            name: pkg.name,
                                            price: String(pkg.price),
                                            durationDays: String(pkg.durationDays),
                                            description: pkg.description || ""
                                        });
                                        setShowModal(true);
                                    }}
                                    className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => handleDelete(pkg.id)}
                                    className="p-1 hover:bg-[#333] rounded text-red-400 hover:text-red-300"
                                >
                                    🗑️
                                </button>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                            <div className="flex items-baseline gap-1 mb-4">
                                <span className="text-3xl font-bold text-indigo-400">฿{pkg.price.toLocaleString()}</span>
                                <span className="text-gray-500">/ {pkg.durationDays} วัน</span>
                            </div>
                            <p className="text-gray-400 text-sm h-12 overflow-hidden">{pkg.description || "-"}</p>

                            <div className="mt-4 pt-4 border-t border-[#333] flex justify-between items-center">
                                <span className={`text-xs px-2 py-1 rounded-full ${pkg.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                                    {pkg.isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e1e1e] rounded-xl border border-[#333] w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editId ? "แก้ไขแพ็คเกจ" : "เพิ่มแพ็คเกจใหม่"}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">ชื่อแพ็คเกจ</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500"
                                    placeholder="เช่น Silver Plan, 30 Days"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">ราคา (บาท)</label>
                                    <input
                                        type="number"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500"
                                        placeholder="1500"
                                        required
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">จำนวนวัน</label>
                                    <input
                                        type="number"
                                        value={formData.durationDays}
                                        onChange={e => setFormData({ ...formData, durationDays: e.target.value })}
                                        className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500"
                                        placeholder="30"
                                        required
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">รายละเอียด (Optional)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 h-24 resize-none"
                                    placeholder="รายละเอียด เช่น เช็คยอดเงินได้, แจ้งเตือน Telegram"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                                >
                                    บันทึก
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PackagesPage() {
    return (
        <ToastProvider>
            <PackagesContent />
        </ToastProvider>
    );
}
