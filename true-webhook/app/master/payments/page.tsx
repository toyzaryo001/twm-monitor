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

interface ConfirmState {
    isOpen: boolean;
    action: "approve" | "reject" | null;
    requestId: string | null;
    networkName: string;
    packageName: string;
    amount: number;
    durationDays: number;
}

export default function PaymentsPage() {
    const { showToast } = useToast();
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [confirm, setConfirm] = useState<ConfirmState>({
        isOpen: false,
        action: null,
        requestId: null,
        networkName: "",
        packageName: "",
        amount: 0,
        durationDays: 0
    });

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

    const openConfirm = (req: PaymentRequest, action: "approve" | "reject") => {
        setConfirm({
            isOpen: true,
            action,
            requestId: req.id,
            networkName: req.network.name,
            packageName: req.package.name,
            amount: req.amount,
            durationDays: req.package.durationDays
        });
    };

    const closeConfirm = () => {
        setConfirm(prev => ({ ...prev, isOpen: false }));
    };

    const executeAction = async () => {
        if (!confirm.requestId || !confirm.action) return;

        setProcessing(true);
        const token = getToken();
        try {
            const res = await fetch(`/api/master/payments/${confirm.requestId}/${confirm.action}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.ok) {
                showToast({
                    type: "success",
                    title: "สำเร็จ",
                    message: confirm.action === "approve" ? "อนุมัติและต่ออายุเรียบร้อยแล้ว" : "ปฏิเสธรายการเรียบร้อยแล้ว"
                });
                fetchRequests();
                setViewImage(null);
            } else {
                showToast({ type: "error", title: "ล้มเหลว", message: data.error || "เกิดข้อผิดพลาด" });
            }
        } catch (e) {
            showToast({ type: "error", title: "ล้มเหลว", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
        }
        setProcessing(false);
        closeConfirm();
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
                    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                        ✅ ไม่มีรายการรอตรวจสอบ
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
                                            <button className="btn btn-primary" style={{ padding: "4px 12px" }} onClick={() => openConfirm(req, "approve")}>
                                                อนุมัติ
                                            </button>
                                            <button className="btn btn-danger" style={{ padding: "4px 8px" }} onClick={() => openConfirm(req, "reject")}>
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

            {/* Confirm Modal */}
            {confirm.isOpen && (
                <div className="modal-overlay" onClick={closeConfirm}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: "center" }}>
                        {/* Icon */}
                        <div style={{
                            width: 80,
                            height: 80,
                            borderRadius: "50%",
                            background: confirm.action === "approve"
                                ? "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))"
                                : "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 20px",
                            fontSize: 40
                        }}>
                            {confirm.action === "approve" ? "✅" : "❌"}
                        </div>

                        {/* Title */}
                        <h2 style={{
                            fontSize: 22,
                            fontWeight: 700,
                            marginBottom: 12,
                            color: confirm.action === "approve" ? "#22c55e" : "#ef4444"
                        }}>
                            {confirm.action === "approve" ? "ยืนยันอนุมัติ?" : "ยืนยันปฏิเสธ?"}
                        </h2>

                        {/* Details */}
                        <div style={{
                            background: "var(--bg-secondary)",
                            borderRadius: 12,
                            padding: 16,
                            marginBottom: 24
                        }}>
                            <div style={{ marginBottom: 8 }}>
                                <span style={{ color: "var(--text-muted)" }}>เครือข่าย: </span>
                                <span style={{ fontWeight: 600 }}>{confirm.networkName}</span>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <span style={{ color: "var(--text-muted)" }}>แพ็คเกจ: </span>
                                <span style={{ fontWeight: 600 }}>{confirm.packageName}</span>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <span style={{ color: "var(--text-muted)" }}>ยอดเงิน: </span>
                                <span style={{ fontWeight: 700, color: "var(--primary)" }}>฿{confirm.amount.toLocaleString()}</span>
                            </div>
                            {confirm.action === "approve" && (
                                <div style={{
                                    marginTop: 12,
                                    padding: 8,
                                    background: "rgba(34, 197, 94, 0.1)",
                                    borderRadius: 8,
                                    color: "#22c55e",
                                    fontWeight: 600
                                }}>
                                    📅 ต่ออายุ +{confirm.durationDays} วัน
                                </div>
                            )}
                        </div>

                        {/* Buttons */}
                        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                            <button
                                className="btn btn-secondary"
                                onClick={closeConfirm}
                                disabled={processing}
                                style={{ minWidth: 100 }}
                            >
                                ยกเลิก
                            </button>
                            <button
                                className={`btn ${confirm.action === "approve" ? "btn-primary" : "btn-danger"}`}
                                onClick={executeAction}
                                disabled={processing}
                                style={{ minWidth: 120 }}
                            >
                                {processing ? "กำลังดำเนินการ..." : confirm.action === "approve" ? "✓ อนุมัติ" : "✕ ปฏิเสธ"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
