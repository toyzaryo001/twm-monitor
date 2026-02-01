"use client";

import { useState, useEffect } from "react";
import { ToastProvider, useToast } from "../../components/Toast";

interface PaymentRequest {
    id: string;
    amount: number;
    slipUrl: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    network: { prefix: string; name: string; expiredAt: string | null; };
    package: { name: string; durationDays: number; };
}

function PaymentsContent() {
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const { showToast } = useToast();

    const fetchRequests = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/master/payments?status=PENDING", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) setRequests(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRequests(); }, []);

    const handleAction = async (id: string, action: "approve" | "reject") => {
        if (!confirm(`ยืนยันการ ${action === "approve" ? "อนุมัติ" : "ปฏิเสธ"} รายการนี้?`)) return;

        setProcessing(id);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/master/payments/${id}/${action}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await res.json();

            if (result.ok) {
                showToast({ title: action === "approve" ? "อนุมัติเรียบร้อย และต่ออายุแล้ว" : "ปฏิเสธรายการแล้ว", type: "success" });
                fetchRequests();
                setViewImage(null);
            } else {
                showToast({ title: result.error || "ทำรายการไม่สำเร็จ", type: "error" });
            }
        } catch (err) {
            showToast({ title: "Error processing request", type: "error" });
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="p-6 md:p-8 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-lg">🧾</span>
                        ตรวจสอบสลิป
                    </h1>
                    <p className="text-gray-400 mt-2 ml-13">รายการแจ้งชำระเงินรอตรวจสอบ</p>
                </div>
                <button
                    onClick={fetchRequests}
                    className="px-5 py-2.5 bg-[#252545] hover:bg-[#303060] text-white rounded-xl flex items-center gap-2 transition-colors border border-[#2a2a4a]"
                >
                    <span className="text-lg">🔄</span> รีเฟรช
                </button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4">
                    <div className="text-3xl font-bold text-amber-400">{requests.length}</div>
                    <div className="text-amber-400/60 text-sm">รอตรวจสอบ</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <div className="text-3xl font-bold text-emerald-400">-</div>
                    <div className="text-emerald-400/60 text-sm">อนุมัติวันนี้</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-4">
                    <div className="text-3xl font-bold text-indigo-400">-</div>
                    <div className="text-indigo-400/60 text-sm">รายได้วันนี้</div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-32">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-24 bg-gradient-to-b from-[#1a1a2e] to-[#16162a] rounded-2xl border border-[#2a2a4a]">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">✅</div>
                    <h3 className="text-xl font-semibold text-white mb-2">ไม่มีรายการรอตรวจสอบ</h3>
                    <p className="text-gray-400">เยี่ยม! คุณตรวจสอบสลิปเรียบร้อยทั้งหมดแล้ว</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {requests.map(req => (
                        <div key={req.id} className="bg-gradient-to-b from-[#1e1e2e] to-[#1a1a28] border border-[#2a2a4a] rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all group">
                            {/* Header */}
                            <div className="p-5 border-b border-[#2a2a4a] flex justify-between items-start bg-[#1a1a28]">
                                <div>
                                    <h3 className="text-lg font-bold text-white">{req.network.name}</h3>
                                    <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-medium">
                                        {req.network.prefix.toUpperCase()}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">แจ้งเมื่อ</div>
                                    <div className="text-sm text-gray-300 font-medium">
                                        {new Date(req.createdAt).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-5">
                                <div className="flex gap-4">
                                    {/* Slip Preview */}
                                    <div
                                        className="w-24 h-28 bg-[#12121e] rounded-xl cursor-pointer overflow-hidden border-2 border-[#2a2a4a] hover:border-emerald-500/50 transition-colors relative group/img flex-shrink-0"
                                        onClick={() => setViewImage(req.slipUrl)}
                                    >
                                        <img src={req.slipUrl} alt="Slip" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                            <span className="text-white text-xs font-medium">🔍 ดูเต็ม</span>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 space-y-2.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-sm">แพ็คเกจ</span>
                                            <span className="text-white font-semibold">{req.package.name}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-sm">ยอดโอน</span>
                                            <span className="text-emerald-400 font-bold text-lg">฿{req.amount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-sm">ต่ออายุ</span>
                                            <span className="text-indigo-400 font-medium">+{req.package.durationDays} วัน</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-[#2a2a4a]">
                                            <span className="text-gray-500 text-xs">หมดอายุปัจจุบัน</span>
                                            <span className="text-gray-400 text-xs">
                                                {req.network.expiredAt ? new Date(req.network.expiredAt).toLocaleDateString("th-TH") : "ไม่ระบุ"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-4 bg-[#16162a] border-t border-[#2a2a4a] grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleAction(req.id, "reject")}
                                    disabled={processing === req.id}
                                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors text-sm font-medium border border-red-500/20 disabled:opacity-50"
                                >
                                    ✕ ปฏิเสธ
                                </button>
                                <button
                                    onClick={() => handleAction(req.id, "approve")}
                                    disabled={processing === req.id}
                                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl transition-all text-sm font-medium shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                                >
                                    {processing === req.id ? "..." : "✓ อนุมัติ"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Image Modal */}
            {viewImage && (
                <div
                    className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setViewImage(null)}
                >
                    <div className="relative max-w-2xl w-full">
                        <img src={viewImage} alt="Full Slip" className="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
                        <button
                            className="absolute -top-4 -right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white text-xl rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
                            onClick={() => setViewImage(null)}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PaymentsPage() {
    return (
        <ToastProvider>
            <PaymentsContent />
        </ToastProvider>
    );
}
