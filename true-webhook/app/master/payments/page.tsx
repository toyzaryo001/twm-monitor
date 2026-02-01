"use client";

import { useState, useEffect } from "react";
import { useToast } from "../../components/Toast";

interface PaymentRequest {
    id: string;
    amount: number;
    slipUrl: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    network: { prefix: string; name: string; expiredAt: string | null; };
    package: { name: string; durationDays: number; };
}

export default function PaymentsPage() {
    const { showToast } = useToast();
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewImage, setViewImage] = useState<string | null>(null);

    const getToken = () => localStorage.getItem("token") || "";

    const fetchRequests = async () => {
        const token = getToken();
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch("/api/master/payments?status=PENDING", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) setRequests(data.data);
        } catch (e) {
            console.error("Error fetching requests", e);
        }
        setLoading(false);
    };

    useEffect(() => { fetchRequests(); }, []);

    const handleAction = async (id: string, action: "approve" | "reject") => {
        if (!confirm(`ยืนยันการ ${action === "approve" ? "อนุมัติ" : "ปฏิเสธ"} รายการนี้?`)) return;

        const token = getToken();
        try {
            const res = await fetch(`/api/master/payments/${id}/${action}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.ok) {
                showToast({
                    type: "success",
                    title: "สำเร็จ",
                    message: action === "approve" ? "อนุมัติและต่ออายุเรียบร้อยแล้ว" : "ปฏิเสธรายการเรียบร้อยแล้ว"
                });
                fetchRequests();
                setViewImage(null);
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
                <h1 className="page-title">ตรวจสอบสลิป</h1>
                <button className="btn btn-secondary" onClick={fetchRequests}>
                    🔄 รีเฟรช
                </button>
            </div>

            <div className="card">
                {requests.length === 0 ? (
                    <div className="empty-state">
                        <span style={{ fontSize: 40, marginBottom: 12, display: "block" }}>✅</span>
                        ไม่มีรายการรอตรวจสอบ
                    </div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>สลิป</th>
                                <th>เครือข่าย</th>
                                <th>แพ็คเกจ</th>
                                <th>ยอดเงิน</th>
                                <th>ต่ออายุ</th>
                                <th>วันที่แจ้ง</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map(req => (
                                <tr key={req.id}>
                                    <td>
                                        <div
                                            onClick={() => setViewImage(req.slipUrl)}
                                            style={{
                                                width: 50,
                                                height: 60,
                                                background: `url(${req.slipUrl}) center/cover`,
                                                borderRadius: 6,
                                                cursor: "pointer",
                                                border: "1px solid var(--border)"
                                            }}
                                        />
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{req.network.name}</div>
                                        <span className="badge badge-secondary">{req.network.prefix.toUpperCase()}</span>
                                    </td>
                                    <td>{req.package.name}</td>
                                    <td>
                                        <span style={{ color: "var(--success)", fontWeight: 700 }}>
                                            ฿{req.amount.toLocaleString()}
                                        </span>
                                    </td>
                                    <td>+{req.package.durationDays} วัน</td>
                                    <td style={{ fontSize: 12 }}>
                                        {new Date(req.createdAt).toLocaleDateString("th-TH")}
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button className="btn btn-primary" style={{ padding: "4px 12px" }} onClick={() => handleAction(req.id, "approve")}>
                                                อนุมัติ
                                            </button>
                                            <button className="btn btn-danger" style={{ padding: "4px 8px" }} onClick={() => handleAction(req.id, "reject")}>
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

            {/* Image Modal */}
            {viewImage && (
                <div className="modal-overlay" onClick={() => setViewImage(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
                        <img
                            src={viewImage}
                            alt="Slip"
                            style={{
                                maxWidth: "90vw",
                                maxHeight: "85vh",
                                borderRadius: 12,
                                boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
                            }}
                        />
                        <button
                            onClick={() => setViewImage(null)}
                            style={{
                                position: "absolute",
                                top: -12,
                                right: -12,
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: "var(--bg-secondary)",
                                color: "white",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 16
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
