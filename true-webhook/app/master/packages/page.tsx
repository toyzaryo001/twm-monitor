"use client";

import { useState, useEffect } from "react";
import { ToastProvider, useToast } from "../../components/Toast";

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
            if (data.ok) setPackages(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPackages(); }, []);

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
            const res = await fetch(url, {
                method: editId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

    const openEdit = (pkg: Package) => {
        setEditId(pkg.id);
        setFormData({
            name: pkg.name,
            price: String(pkg.price),
            durationDays: String(pkg.durationDays),
            description: pkg.description || ""
        });
        setShowModal(true);
    };

    return (
        <div className="p-6 md:p-8 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-lg">📦</span>
                        จัดการแพ็คเกจ
                    </h1>
                    <p className="text-gray-400 mt-2 ml-13">กำหนดราคาและระยะเวลาสำหรับบริการ</p>
                </div>
                <button
                    onClick={() => {
                        setEditId(null);
                        setFormData({ name: "", price: "", durationDays: "30", description: "" });
                        setShowModal(true);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 font-medium"
                >
                    <span className="text-lg">+</span> เพิ่มแพ็คเกจ
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-32">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : packages.length === 0 ? (
                <div className="text-center py-24 bg-gradient-to-b from-[#1a1a2e] to-[#16162a] rounded-2xl border border-[#2a2a4a]">
                    <div className="w-20 h-20 bg-[#252545] rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">📦</div>
                    <h3 className="text-xl font-semibold text-white mb-2">ยังไม่มีแพ็คเกจ</h3>
                    <p className="text-gray-400 mb-6">เริ่มต้นสร้างแพ็คเกจแรกของคุณ</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors"
                    >
                        + สร้างแพ็คเกจ
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {packages.map((pkg, i) => (
                        <div
                            key={pkg.id}
                            className="relative bg-gradient-to-b from-[#1e1e2e] to-[#1a1a28] border border-[#2a2a4a] rounded-2xl p-6 group hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-500/10"
                        >
                            {/* Popular Badge (for first item) */}
                            {i === 0 && packages.length > 1 && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-xs font-bold text-white shadow-lg">
                                    ⭐ ยอดนิยม
                                </div>
                            )}

                            {/* Actions */}
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button onClick={() => openEdit(pkg)} className="w-8 h-8 flex items-center justify-center bg-[#333355] hover:bg-[#444466] rounded-lg text-gray-300 hover:text-white transition-colors">
                                    ✏️
                                </button>
                                <button onClick={() => handleDelete(pkg.id)} className="w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors">
                                    🗑️
                                </button>
                            </div>

                            {/* Content */}
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white mb-1">{pkg.name}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${pkg.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                                    {pkg.isActive ? "● เปิดใช้งาน" : "○ ปิดใช้งาน"}
                                </span>
                            </div>

                            {/* Price */}
                            <div className="mb-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                        ฿{pkg.price.toLocaleString()}
                                    </span>
                                </div>
                                <span className="text-gray-500 text-sm">/ {pkg.durationDays} วัน</span>
                            </div>

                            {/* Description */}
                            <div className="min-h-[60px] text-gray-400 text-sm border-t border-[#2a2a4a] pt-4">
                                {pkg.description || <span className="text-gray-600 italic">ไม่มีรายละเอียด</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
                    <div
                        className="bg-gradient-to-b from-[#1e1e2e] to-[#16162a] rounded-2xl border border-[#2a2a4a] w-full max-w-md shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-[#2a2a4a] flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                <span className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
                                    {editId ? "✏️" : "📦"}
                                </span>
                                {editId ? "แก้ไขแพ็คเกจ" : "เพิ่มแพ็คเกจใหม่"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#333355] rounded-lg transition-colors">
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">ชื่อแพ็คเกจ</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-[#12121e] border border-[#2a2a4a] rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    placeholder="เช่น Silver, Gold, Premium"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">ราคา (บาท)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">฿</span>
                                        <input
                                            type="number"
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                                            className="w-full bg-[#12121e] border border-[#2a2a4a] rounded-xl pl-8 pr-4 py-3 text-white placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            placeholder="1500"
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">จำนวนวัน</label>
                                    <input
                                        type="number"
                                        value={formData.durationDays}
                                        onChange={e => setFormData({ ...formData, durationDays: e.target.value })}
                                        className="w-full bg-[#12121e] border border-[#2a2a4a] rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder="30"
                                        required
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">รายละเอียด <span className="text-gray-600">(ไม่บังคับ)</span></label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-[#12121e] border border-[#2a2a4a] rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all h-24 resize-none"
                                    placeholder="ฟีเจอร์ที่รวมในแพ็คเกจ..."
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-3 bg-[#252545] hover:bg-[#303060] text-gray-300 rounded-xl transition-colors font-medium"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/25 font-medium"
                                >
                                    {editId ? "บันทึกการแก้ไข" : "สร้างแพ็คเกจ"}
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
