"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../components/Toast";
import { masterFetch } from "../../lib/masterFetch";
import { ConfirmModal, EmptyState, PageHeader, StatCard, TableShell } from "../components/MasterUI";

interface PaymentRequest {
    id: string;
    amount: number;
    slipUrl: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    network: { prefix: string; name: string; expiredAt: string | null };
    package: { name: string; durationDays: number };
}

interface ConfirmState {
    action: "approve" | "reject";
    request: PaymentRequest;
}

export default function PaymentsPage() {
    const { showToast } = useToast();
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);

    const fetchRequests = async () => {
        try {
            const data = await masterFetch<{ ok: true; data: PaymentRequest[] }>("/api/master/payments?status=PENDING");
            setRequests(data.data);
        } catch (error) {
            showToast({ type: "error", title: "โหลดรายการไม่สำเร็จ", message: error instanceof Error ? error.message : "PAYMENTS_LOAD_FAILED" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const executeAction = async () => {
        if (!confirm) return;
        setProcessing(true);
        try {
            await masterFetch(`/api/master/payments/${confirm.request.id}/${confirm.action}`, { method: "POST" });
            showToast({
                type: "success",
                title: "ดำเนินการสำเร็จ",
                message: confirm.action === "approve" ? "อนุมัติและต่ออายุเรียบร้อยแล้ว" : "ปฏิเสธรายการเรียบร้อยแล้ว",
            });
            setConfirm(null);
            setViewImage(null);
            await fetchRequests();
        } catch (error) {
            showToast({ type: "error", title: "ดำเนินการไม่สำเร็จ", message: error instanceof Error ? error.message : "PAYMENT_ACTION_FAILED" });
        } finally {
            setProcessing(false);
        }
    };

    const totalPending = requests.reduce((sum, item) => sum + item.amount, 0);

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <PageHeader
                eyebrow="Payment Review"
                title="ตรวจสลิป"
                description="ตรวจรายการต่ออายุที่ tenant ส่งเข้ามา อนุมัติแล้วระบบจะต่ออายุให้อัตโนมัติ"
                actions={<button className="btn btn-secondary" onClick={fetchRequests}>รีเฟรช</button>}
            />

            <div className="stats-grid">
                <StatCard label="รายการรอตรวจ" value={requests.length} tone={requests.length > 0 ? "red" : "green"} />
                <StatCard label="ยอดรอตรวจรวม" value={`฿${totalPending.toLocaleString("th-TH")}`} tone="gold" />
            </div>

            <TableShell>
                {requests.length === 0 ? (
                    <EmptyState title="ไม่มีรายการรอตรวจ" description="รายการที่ tenant ส่งสลิปจะมาแสดงที่นี่" />
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>สลิป</th>
                                    <th>เครือข่าย</th>
                                    <th>แพ็คเกจ</th>
                                    <th>ยอดเงิน</th>
                                    <th>วันที่แจ้ง</th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((request) => (
                                    <tr key={request.id}>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => setViewImage(request.slipUrl)}
                                                style={{
                                                    width: 54,
                                                    height: 68,
                                                    background: `url(${request.slipUrl}) center/cover`,
                                                    borderRadius: 8,
                                                    border: "1px solid var(--border)",
                                                    cursor: "pointer",
                                                }}
                                                aria-label="ดูสลิป"
                                            />
                                        </td>
                                        <td>
                                            <div className="table-title">{request.network.name}</div>
                                            <div className="table-subtitle"><code>{request.network.prefix}</code></div>
                                        </td>
                                        <td>
                                            <div className="table-title">{request.package.name}</div>
                                            <div className="table-subtitle">ต่ออายุ +{request.package.durationDays} วัน</div>
                                        </td>
                                        <td style={{ color: "var(--success)", fontWeight: 900 }}>฿{request.amount.toLocaleString("th-TH")}</td>
                                        <td>{new Date(request.createdAt).toLocaleString("th-TH")}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn btn-primary btn-compact" onClick={() => setConfirm({ action: "approve", request })}>อนุมัติ</button>
                                                <button className="btn btn-danger btn-compact" onClick={() => setConfirm({ action: "reject", request })}>ปฏิเสธ</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </TableShell>

            {viewImage && (
                <div className="modal-overlay" onClick={() => setViewImage(null)}>
                    <div onClick={(event) => event.stopPropagation()} style={{ position: "relative" }}>
                        <img src={viewImage} alt="Payment slip" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 8, boxShadow: "var(--shadow-lg)" }} />
                        <button className="btn btn-secondary" onClick={() => setViewImage(null)} style={{ position: "absolute", top: 10, right: 10 }}>ปิด</button>
                    </div>
                </div>
            )}

            {confirm && (
                <ConfirmModal
                    title={confirm.action === "approve" ? "อนุมัติรายการนี้?" : "ปฏิเสธรายการนี้?"}
                    message={
                        <div>
                            <div>{confirm.request.network.name} - {confirm.request.package.name}</div>
                            <div style={{ marginTop: 6, color: "var(--accent-gold)", fontWeight: 900 }}>฿{confirm.request.amount.toLocaleString("th-TH")}</div>
                        </div>
                    }
                    confirmText={confirm.action === "approve" ? "อนุมัติ" : "ปฏิเสธ"}
                    tone={confirm.action === "approve" ? "success" : "danger"}
                    busy={processing}
                    onCancel={() => setConfirm(null)}
                    onConfirm={executeAction}
                />
            )}
        </div>
    );
}
