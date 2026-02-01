"use client";

import { useState, useEffect } from "react";
import { ToastProvider, useToast } from "../../components/Toast";

interface PaymentRequest {
    id: string;
    amount: number;
    slipUrl: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    network: {
        prefix: string;
        name: string;
        expiredAt: string | null;
    };
    package: {
        name: string;
        durationDays: number;
    };
}

function PaymentsContent() {
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const { showToast } = useToast();

    const fetchRequests = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/master/payments?status=PENDING", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) {
                setRequests(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (id: string, action: "approve" | "reject") => {
        if (!confirm(`ยืนยันการ ${action === "approve" ? "อนุมัติ" : "ปฏิเสธ"} รายการนี้?`)) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/master/payments/${id}/${action}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await res.json();

            if (result.ok) {
                showToast({ title: action === "approve" ? "อนุมัติเรียบร้อย และต่ออายุแล้ว" : "ปฏิเสธรายการแล้ว", type: "success" });
                fetchRequests(); // Refresh list
                setViewImage(null);
            } else {
                showToast({ title: result.error || "ทำรายการไม่สำเร็จ", type: "error" });
            }
        } catch (err) {
            showToast({ title: "Error processing request", type: "error" });
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">ตรวจสอบสลิป</h1>
                    <p className="text-gray-400">รายการแจ้งชำระเงินรอตรวจสอบ</p>
                </div>
                <button
                    onClick={fetchRequests}
                    className="px-4 py-2 bg-[#333] hover:bg-[#444] text-white rounded-lg transition-colors"
                >
                    🔄 รีเฟรช
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
            ) : requests.length === 0 ? (
                <div className="text-center py-20 bg-[#1e1e1e] rounded-xl border border-[#333]">
                    <div className="text-4xl mb-4">✅</div>
                    <p className="text-gray-400">ไม่มีรายการรอตรวจสอบ</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {requests.map(req => (
                        <div key={req.id} className="bg-[#1e1e1e] border border-[#333] rounded-xl overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="p-4 border-b border-[#333] flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white">{req.network.name}</h3>
                                    <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">
                                        {req.network.prefix.toUpperCase()}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">วันที่แจ้ง</div>
                                    <div className="text-sm text-gray-300">
                                        {new Date(req.createdAt).toLocaleString("th-TH")}
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-4 flex-1">
                                <div className="flex gap-4 mb-4">
                                    <div
                                        className="w-24 h-24 bg-[#111] rounded-lg cursor-pointer overflow-hidden border border-[#333] relative"
                                        onClick={() => setViewImage(req.slipUrl)}
                                    >
                                        <img src={req.slipUrl} alt="Slip" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-xs text-gray-500 bg-black/50 px-1 rounded">🔍 Zoom</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">แพ็คเกจ:</span>
                                            <span className="text-white font-medium">{req.package.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">ราคา:</span>
                                            <span className="text-green-400 font-bold">฿{req.amount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">ต่ออายุ:</span>
                                            <span className="text-white">+{req.package.durationDays} วัน</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">หมดอายุปัจจุบัน:</span>
                                            <span className="text-gray-300">
                                                {req.network.expiredAt ? new Date(req.network.expiredAt).toLocaleDateString("th-TH") : "-"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-4 bg-[#252525] border-t border-[#333] grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleAction(req.id, "reject")}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors text-sm font-medium"
                                >
                                    ปฏิเสธ
                                </button>
                                <button
                                    onClick={() => handleAction(req.id, "approve")}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-medium"
                                >
                                    อนุมัติ
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Image Modal */}
            {viewImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setViewImage(null)}
                >
                    <img
                        src={viewImage}
                        alt="Full Slip"
                        className="max-w-full max-h-[90vh] rounded shadow-2xl"
                    />
                    <button className="absolute top-4 right-4 text-white text-xl bg-white/10 w-10 h-10 rounded-full hover:bg-white/20">
                        ✕
                    </button>
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
