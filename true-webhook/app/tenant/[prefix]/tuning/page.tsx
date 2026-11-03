"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useToast } from "../../../components/Toast";

interface AccountTuning {
    id: string;
    name: string;
    phoneNumber?: string;
    isActive: boolean;
    currentFeeTotal: number;
    currentFeeCount: number;
    currentReceiveCount: number;
    tuningConfig?: {
        targetFeeAmount?: number;
        targetFeeCount?: number;
        targetReceiveCount?: number;
        lastDiffFee?: number;
        note?: string;
        tunedAt?: string;
        tunedBy?: string;
    } | null;
    adjustments: Array<{
        id: string;
        transactionId: string;
        amount: number;
        type: string;
        timestamp: string;
        diffFee: number;
        note: string;
        tunedBy: string;
        targetFeeAmount?: number;
        targetReceiveCount?: number;
    }>;
}

export default function TenantTuningPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [accounts, setAccounts] = useState<AccountTuning[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>("");

    // Form inputs for "ข้อมูลจากหน้าแอป"
    const [targetCount, setTargetCount] = useState<string>("");
    const [targetAmount, setTargetAmount] = useState<string>("");
    const [note, setNote] = useState<string>("");

    // Modern Confirm Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    const fetchTuningData = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        const token = getToken();

        try {
            const res = await fetch(`/api/tenant/${prefix}/tuning`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.status === 401) {
                localStorage.removeItem("tenantToken");
                window.location.href = `/tenant/${prefix}/login`;
                return;
            }

            const json = await res.json();
            if (json.ok && Array.isArray(json.data)) {
                setAccounts(json.data);
                if (json.data.length > 0) {
                    setSelectedAccountId(prev => {
                        const exists = json.data.some((a: AccountTuning) => a.id === prev);
                        return exists ? prev : json.data[0].id;
                    });
                }
            } else {
                showToast({ type: "error", title: "โหลดข้อมูลไม่สำเร็จ", message: json.error || "เกิดข้อผิดพลาด" });
            }
        } catch (e) {
            console.error("Error fetching tuning data", e);
            showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
        }
        setLoading(false);
    }, [prefix, showToast]);

    useEffect(() => {
        fetchTuningData(true);
    }, [fetchTuningData]);

    const activeAccount = accounts.find(a => a.id === selectedAccountId);

    // Sync form inputs whenever activeAccount changes or loads
    useEffect(() => {
        if (!activeAccount) return;
        setTargetCount(String(activeAccount.currentFeeCount ?? 0));
        setTargetAmount(Number(activeAccount.currentFeeTotal ?? 0).toFixed(2));
        setNote(`ปรับจูนให้ตรงกับหน้าแอป TrueMoney ณ ${new Date().toLocaleDateString("th-TH")}`);
    }, [activeAccount]);

    // Numerical values and deltas
    const numTargetCount = parseInt(targetCount, 10) || 0;
    const numTargetAmount = parseFloat(targetAmount) || 0;

    const currentCount = activeAccount ? activeAccount.currentFeeCount : 0;
    const currentAmount = activeAccount ? activeAccount.currentFeeTotal : 0;

    const diffCount = numTargetCount - currentCount;
    const diffAmount = Math.round((numTargetAmount - currentAmount) * 100) / 100;

    // Reset to current program values
    const handleReset = () => {
        if (!activeAccount) return;
        setTargetCount(String(activeAccount.currentFeeCount ?? 0));
        setTargetAmount(Number(activeAccount.currentFeeTotal ?? 0).toFixed(2));
        showToast({
            type: "info",
            title: "ยกเลิกการปรับจูน",
            message: "คืนค่าข้อมูลจากหน้าแอปให้ตรงกับค่าในระบบปัจจุบันเรียบร้อยแล้ว"
        });
    };

    // Open confirmation modal
    const handleOpenConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeAccount) return;

        if (isNaN(numTargetAmount) || numTargetAmount < 0) {
            showToast({ type: "error", title: "ยอดเงินไม่ถูกต้อง", message: "กรุณาระบุยอดเงินที่ถูกต้อง" });
            return;
        }

        if (isNaN(numTargetCount) || numTargetCount < 0) {
            showToast({ type: "error", title: "จำนวนรายการไม่ถูกต้อง", message: "กรุณาระบุจำนวนรายการที่ถูกต้อง" });
            return;
        }

        setShowConfirmModal(true);
    };

    // Save tuning to backend
    const handleConfirmSubmit = async () => {
        if (!activeAccount) return;
        setSubmitting(true);
        const token = getToken();

        try {
            const res = await fetch(`/api/tenant/${prefix}/tuning`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    accountId: activeAccount.id,
                    targetFeeAmount: numTargetAmount,
                    targetFeeCount: numTargetCount,
                    targetReceiveCount: numTargetCount,
                    note: note.trim()
                })
            });

            const data = await res.json();
            if (data.ok) {
                setShowConfirmModal(false);
                showToast({
                    type: "success",
                    title: "ปรับจูนสำเร็จ ✨",
                    message: `ปรับเป็น ${numTargetCount.toLocaleString()} รายการ / ฿ ${numTargetAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} เรียบร้อยแล้ว ระบบจะนับต่อจากยอดนี้ทันที`
                });
                await fetchTuningData(false);
            } else {
                showToast({
                    type: "error",
                    title: "บันทึกไม่สำเร็จ",
                    message: data.error || "เกิดข้อผิดพลาดในการบันทึก"
                });
            }
        } catch (e) {
            console.error("Submit tuning error", e);
            showToast({ type: "error", title: "ข้อผิดพลาด", message: "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
        }
        setSubmitting(false);
    };

    if (loading) {
        return (
            <div className="flex-center" style={{ padding: 100 }}>
                <div className="spinner" />
            </div>
        );
    }

    if (accounts.length === 0) {
        return (
            <div className="tenant-card" style={{ textAlign: "center", padding: 60, borderRadius: 16 }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--theme-text-primary)", marginBottom: 8 }}>
                    ยังไม่มีบัญชีวอลเล็ท
                </div>
                <div style={{ color: "var(--theme-text-muted)" }}>
                    กรุณาเพิ่มบัญชีวอลเล็ทที่เมนู "บัญชีวอลเล็ท" ก่อนดำเนินการปรับจูน
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 60 }}>
            {/* Page Header */}
            <div className="tenant-page-header" style={{ marginBottom: 20 }}>
                <div>
                    <h1 className="tenant-page-title" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "1.5rem", fontWeight: 700 }}>
                        <span style={{ fontSize: "1.5rem" }}>⚖️</span> ปรับจูนข้อมูล (Calibration)
                    </h1>
                    <div style={{ fontSize: "0.88rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                        ปรับข้อมูลจำนวนรายการและยอดเงินให้ตรงกับหน้าแอป TrueMoney โดยระบบจะใช้ข้อมูลที่ปรับจูน และนับต่ออัตโนมัติเมื่อมีรายการใหม่
                    </div>
                </div>
            </div>

            {/* Wallet Selection Pills */}
            {accounts.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
                    {accounts.map(acc => (
                        <button
                            key={acc.id}
                            type="button"
                            onClick={() => setSelectedAccountId(acc.id)}
                            className={`tenant-btn ${acc.id === selectedAccountId ? "tenant-btn-primary" : "tenant-btn-secondary"}`}
                            style={{ padding: "8px 18px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}
                        >
                            <span>{acc.name}</span>
                            <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>({acc.phoneNumber || "-"})</span>
                        </button>
                    ))}
                </div>
            )}

            {activeAccount && (
                <form onSubmit={handleOpenConfirm}>
                    {/* Active Wallet Banner */}
                    <div style={{
                        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%)",
                        border: "1px solid var(--theme-border-subtle)",
                        borderRadius: 14,
                        padding: "16px 20px",
                        marginBottom: 20,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12
                    }}>
                        <div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--theme-text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                                <span>📱 บัญชี:</span> {activeAccount.name}
                            </div>
                            <div style={{ fontSize: "0.84rem", color: "var(--theme-text-muted)", marginTop: 2 }}>
                                เบอร์โทร: <span style={{ fontFamily: "monospace", color: "var(--theme-text-secondary)" }}>{activeAccount.phoneNumber || "ไม่ระบุ"}</span> | สถานะ: {activeAccount.isActive ? <span style={{ color: "#10b981", fontWeight: 600 }}>ใช้งานปกติ</span> : <span style={{ color: "var(--theme-text-muted)" }}>ปิดใช้งาน</span>}
                            </div>
                        </div>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            background: "rgba(16, 185, 129, 0.1)",
                            border: "1px solid rgba(16, 185, 129, 0.25)",
                            padding: "6px 14px",
                            borderRadius: 20,
                            fontSize: "0.82rem",
                            color: "#10b981",
                            fontWeight: 600
                        }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                            โหมดซิงค์ต่ออัตโนมัติ (Active)
                        </div>
                    </div>

                    {/* Main Side-by-Side Comparison Grid */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                        gap: 20,
                        marginBottom: 20
                    }}>
                        {/* COLUMN 1: ข้อมูลจากหน้าแอป (Editable) */}
                        <div style={{
                            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.6) 100%)",
                            border: "1.5px solid rgba(16, 185, 129, 0.45)",
                            borderRadius: 18,
                            padding: 24,
                            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.45), 0 0 20px rgba(16, 185, 129, 0.08)",
                            display: "flex",
                            flexDirection: "column",
                            position: "relative"
                        }}>
                            {/* Card Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: "rgba(16, 185, 129, 0.15)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "1.2rem"
                                    }}>
                                        📲
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--theme-text-primary)" }}>
                                            ข้อมูลจากหน้าแอป
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: "var(--theme-text-muted)" }}>
                                            กรอกข้อมูลจากหน้าแอป TrueMoney
                                        </div>
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: "0.75rem",
                                    padding: "3px 10px",
                                    borderRadius: 12,
                                    background: "rgba(16, 185, 129, 0.18)",
                                    color: "#34d399",
                                    border: "1px solid rgba(16, 185, 129, 0.3)",
                                    fontWeight: 600
                                }}>
                                    สามารถกรอกได้
                                </span>
                            </div>

                            {/* Field 1: จำนวนรายการ */}
                            <div className="tenant-form-group" style={{ marginBottom: 20 }}>
                                <label className="tenant-form-label" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 8, display: "block" }}>
                                    จำนวนรายการ
                                </label>
                                <div style={{
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    background: "rgba(0, 0, 0, 0.35)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    borderRadius: 12,
                                    padding: "6px 14px",
                                    transition: "all 0.2s ease"
                                }}>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={targetCount}
                                        onChange={(e) => setTargetCount(e.target.value)}
                                        placeholder="0"
                                        required
                                        style={{
                                            flex: 1,
                                            background: "transparent",
                                            border: "none",
                                            outline: "none",
                                            color: "var(--theme-text-primary)",
                                            fontSize: "1.45rem",
                                            fontFamily: "ui-monospace, monospace",
                                            fontWeight: 700,
                                            padding: "6px 0"
                                        }}
                                    />
                                    <span style={{
                                        fontSize: "0.9rem",
                                        fontWeight: 600,
                                        color: "var(--theme-text-muted)",
                                        marginLeft: 8
                                    }}>
                                        รายการ
                                    </span>
                                </div>
                            </div>

                            {/* Field 2: ยอดเงิน */}
                            <div className="tenant-form-group" style={{ marginBottom: 12 }}>
                                <label className="tenant-form-label" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 8, display: "block" }}>
                                    ยอดเงิน
                                </label>
                                <div style={{
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    background: "rgba(0, 0, 0, 0.35)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    borderRadius: 12,
                                    padding: "6px 14px",
                                    transition: "all 0.2s ease"
                                }}>
                                    <span style={{
                                        fontSize: "1.2rem",
                                        fontWeight: 700,
                                        color: "var(--theme-text-muted)",
                                        marginRight: 8
                                    }}>
                                        ฿
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={targetAmount}
                                        onChange={(e) => setTargetAmount(e.target.value)}
                                        placeholder="0.00"
                                        required
                                        style={{
                                            flex: 1,
                                            background: "transparent",
                                            border: "none",
                                            outline: "none",
                                            color: "var(--theme-text-primary)",
                                            fontSize: "1.45rem",
                                            fontFamily: "ui-monospace, monospace",
                                            fontWeight: 700,
                                            padding: "6px 0"
                                        }}
                                    />
                                    <span style={{
                                        fontSize: "0.9rem",
                                        fontWeight: 600,
                                        color: "var(--theme-text-muted)",
                                        marginLeft: 8
                                    }}>
                                        บาท
                                    </span>
                                </div>
                            </div>

                            <div style={{ fontSize: "0.78rem", color: "var(--theme-text-muted)", marginTop: "auto", paddingTop: 8 }}>
                                * นำตัวเลขตรงจากหน้าแอปมาวาง ระบบจะคำนวณส่วนต่างอัตโนมัติ
                            </div>
                        </div>

                        {/* COLUMN 2: ข้อมูลจากโปรแกรม (Read-Only) */}
                        <div style={{
                            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.3) 0%, rgba(15, 23, 42, 0.45) 100%)",
                            border: "1.5px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 18,
                            padding: 24,
                            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.35)",
                            display: "flex",
                            flexDirection: "column"
                        }}>
                            {/* Card Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: "rgba(255, 255, 255, 0.08)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "1.2rem"
                                    }}>
                                        💻
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--theme-text-primary)" }}>
                                            ข้อมูลจากโปรแกรม
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: "var(--theme-text-muted)" }}>
                                            ค่าที่บันทึกอยู่ในระบบปัจจุบัน
                                        </div>
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: "0.75rem",
                                    padding: "3px 10px",
                                    borderRadius: 12,
                                    background: "rgba(255, 255, 255, 0.08)",
                                    color: "var(--theme-text-muted)",
                                    border: "1px solid var(--theme-border-subtle)",
                                    fontWeight: 600
                                }}>
                                    แสดงผลเท่านั้น
                                </span>
                            </div>

                            {/* Field 1: จำนวนรายการ */}
                            <div className="tenant-form-group" style={{ marginBottom: 20 }}>
                                <label className="tenant-form-label" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 8, display: "block" }}>
                                    จำนวนรายการ
                                </label>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    background: "rgba(0, 0, 0, 0.25)",
                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                    borderRadius: 12,
                                    padding: "12px 16px"
                                }}>
                                    <span style={{
                                        color: "var(--theme-text-primary)",
                                        fontSize: "1.45rem",
                                        fontFamily: "ui-monospace, monospace",
                                        fontWeight: 700
                                    }}>
                                        {currentCount.toLocaleString()}
                                    </span>
                                    <span style={{
                                        fontSize: "0.9rem",
                                        fontWeight: 600,
                                        color: "var(--theme-text-muted)"
                                    }}>
                                        รายการ
                                    </span>
                                </div>
                            </div>

                            {/* Field 2: ยอดเงิน */}
                            <div className="tenant-form-group" style={{ marginBottom: 12 }}>
                                <label className="tenant-form-label" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 8, display: "block" }}>
                                    ยอดเงิน
                                </label>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    background: "rgba(0, 0, 0, 0.25)",
                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                    borderRadius: 12,
                                    padding: "12px 16px"
                                }}>
                                    <span style={{
                                        color: "var(--theme-text-primary)",
                                        fontSize: "1.45rem",
                                        fontFamily: "ui-monospace, monospace",
                                        fontWeight: 700
                                    }}>
                                        ฿ {currentAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span style={{
                                        fontSize: "0.9rem",
                                        fontWeight: 600,
                                        color: "var(--theme-text-muted)"
                                    }}>
                                        บาท
                                    </span>
                                </div>
                            </div>

                            <div style={{ fontSize: "0.78rem", color: "var(--theme-text-muted)", marginTop: "auto", paddingTop: 8 }}>
                                * ข้อมูลรวมทั้งหมดของวอลเล็ทนี้ในระบบปัจจุบัน
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Delta Comparison Preview */}
                    <div style={{
                        background: "rgba(255, 255, 255, 0.025)",
                        border: "1px solid var(--theme-border-subtle)",
                        borderRadius: 14,
                        padding: "14px 20px",
                        marginBottom: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 16
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: "var(--theme-text-secondary)" }}>
                            <span>📊</span>
                            <span>สรุปส่วนต่างที่จะปรับปรุง:</span>
                        </div>
                        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                            {/* Delta Count */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: "0.82rem", color: "var(--theme-text-muted)" }}>รายการ:</span>
                                <span style={{
                                    fontFamily: "ui-monospace, monospace",
                                    fontWeight: 700,
                                    fontSize: "0.95rem",
                                    color: diffCount > 0 ? "#10b981" : diffCount < 0 ? "#ef4444" : "var(--theme-text-muted)"
                                }}>
                                    {diffCount > 0 ? `+${diffCount.toLocaleString()}` : diffCount < 0 ? diffCount.toLocaleString() : "ตรงกันแล้ว (0)"} รายการ
                                </span>
                            </div>

                            <span style={{ color: "var(--theme-border-subtle)" }}>|</span>

                            {/* Delta Amount */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: "0.82rem", color: "var(--theme-text-muted)" }}>ยอดเงิน:</span>
                                <span style={{
                                    fontFamily: "ui-monospace, monospace",
                                    fontWeight: 700,
                                    fontSize: "0.95rem",
                                    color: diffAmount > 0 ? "#10b981" : diffAmount < 0 ? "#ef4444" : "var(--theme-text-muted)"
                                }}>
                                    {diffAmount > 0 ? `+ ฿ ${diffAmount.toFixed(2)}` : diffAmount < 0 ? `- ฿ ${Math.abs(diffAmount).toFixed(2)}` : "ตรงกันแล้ว (0.00)"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons (ยืนยัน สีเขียว / ยกเลิก สีแดง) */}
                    <div style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 16,
                        marginBottom: 40
                    }}>
                        {/* Cancel Button (สีแดง) */}
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={submitting}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "12px 28px",
                                borderRadius: 12,
                                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                                color: "#ffffff",
                                border: "none",
                                fontSize: "1rem",
                                fontWeight: 700,
                                cursor: submitting ? "not-allowed" : "pointer",
                                boxShadow: "0 4px 16px rgba(239, 68, 68, 0.35)",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <span>✕</span>
                            <span>ยกเลิกการปรับจูน</span>
                        </button>

                        {/* Confirm Button (สีเขียว) */}
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "12px 34px",
                                borderRadius: 12,
                                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                color: "#ffffff",
                                border: "none",
                                fontSize: "1rem",
                                fontWeight: 700,
                                cursor: submitting ? "not-allowed" : "pointer",
                                boxShadow: "0 4px 20px rgba(16, 185, 129, 0.45)",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <span>✓</span>
                            <span>ยืนยันการปรับจูน</span>
                        </button>
                    </div>
                </form>
            )}

            {/* Modern Confirmation Modal Popup (เด้งขึ้นให้ยืนยันอีกครั้ง) */}
            {showConfirmModal && activeAccount && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.8)",
                        backdropFilter: "blur(12px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: 20
                    }}
                    onClick={() => !submitting && setShowConfirmModal(false)}
                >
                    <div
                        style={{
                            maxWidth: 500,
                            width: "100%",
                            background: "linear-gradient(180deg, #181d26 0%, #0e121a 100%)",
                            border: "1.5px solid rgba(16, 185, 129, 0.4)",
                            borderRadius: 20,
                            padding: 28,
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.15)",
                            position: "relative"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{ textAlign: "center", marginBottom: 20 }}>
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                background: "rgba(16, 185, 129, 0.15)",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 14px",
                                fontSize: "1.8rem"
                            }}>
                                ⚖️
                            </div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--theme-text-primary)" }}>
                                ยืนยันการปรับจูนข้อมูล
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                                กรุณาตรวจสอบข้อมูลสำหรับวอลเล็ท "{activeAccount.name}"
                            </div>
                        </div>

                        {/* Comparison Breakdown Table */}
                        <div style={{
                            background: "rgba(0, 0, 0, 0.35)",
                            border: "1px solid var(--theme-border-subtle)",
                            borderRadius: 14,
                            padding: "16px",
                            marginBottom: 20
                        }}>
                            {/* Row 1: จำนวนรายการ */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                                <div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--theme-text-muted)" }}>จำนวนรายการ</div>
                                    <div style={{ fontSize: "0.95rem", color: "var(--theme-text-secondary)", textDecoration: "line-through", fontFamily: "monospace" }}>
                                        {currentCount.toLocaleString()} รายการ
                                    </div>
                                </div>
                                <div style={{ fontSize: "1.2rem", color: "#10b981" }}>➔</div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: "0.85rem", color: "#34d399", fontWeight: 600 }}>เป้าหมายใหม่</div>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--theme-text-primary)", fontFamily: "monospace" }}>
                                        {numTargetCount.toLocaleString()} รายการ
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: ยอดเงิน */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12 }}>
                                <div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--theme-text-muted)" }}>ยอดเงินค่าธรรมเนียม</div>
                                    <div style={{ fontSize: "0.95rem", color: "var(--theme-text-secondary)", textDecoration: "line-through", fontFamily: "monospace" }}>
                                        ฿ {currentAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div style={{ fontSize: "1.2rem", color: "#10b981" }}>➔</div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: "0.85rem", color: "#34d399", fontWeight: 600 }}>เป้าหมายใหม่</div>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--theme-text-primary)", fontFamily: "monospace" }}>
                                        ฿ {numTargetAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Guarantee / Flow Notice */}
                        <div style={{
                            background: "rgba(16, 185, 129, 0.08)",
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                            borderRadius: 12,
                            padding: "12px 14px",
                            marginBottom: 24,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10
                        }}>
                            <span style={{ fontSize: "1.1rem" }}>⚡</span>
                            <div style={{ fontSize: "0.82rem", color: "var(--theme-text-secondary)", lineHeight: 1.5 }}>
                                <strong style={{ color: "var(--theme-text-primary)" }}>หลังปรับจูนเสร็จ:</strong> ระบบจะใช้ข้อมูลที่ปรับจูนนี้เป็นฐาน และเมื่อมีรายการใหม่เข้ามาจาก Webhook ระบบจะ <strong>นับต่อและเพิ่มต่อจากยอดที่ปรับจูนโดยอัตโนมัติ</strong>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div style={{ display: "flex", gap: 12 }}>
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={submitting}
                                style={{
                                    flex: 1,
                                    padding: "12px",
                                    borderRadius: 10,
                                    background: "rgba(255, 255, 255, 0.08)",
                                    border: "1px solid var(--theme-border-subtle)",
                                    color: "var(--theme-text-primary)",
                                    fontSize: "0.95rem",
                                    fontWeight: 600,
                                    cursor: "pointer"
                                }}
                            >
                                กลับไปแก้ไข
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSubmit}
                                disabled={submitting}
                                style={{
                                    flex: 1.3,
                                    padding: "12px",
                                    borderRadius: 10,
                                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                    border: "none",
                                    color: "#ffffff",
                                    fontSize: "0.95rem",
                                    fontWeight: 700,
                                    cursor: submitting ? "not-allowed" : "pointer",
                                    boxShadow: "0 4px 16px rgba(16, 185, 129, 0.4)"
                                }}
                            >
                                {submitting ? "กำลังบันทึก..." : "ยืนยันการปรับจูน"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Audit History Table */}
            {activeAccount && activeAccount.adjustments && activeAccount.adjustments.length > 0 && (
                <div className="tenant-card" style={{ borderRadius: 16 }}>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--theme-text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>📋</span> ประวัติการปรับจูนยอดยกมา (Audit History)
                    </div>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--theme-border-subtle)", color: "var(--theme-text-muted)" }}>
                                    <th style={{ textAlign: "left", padding: "10px 8px" }}>วัน-เวลา</th>
                                    <th style={{ textAlign: "right", padding: "10px 8px" }}>ส่วนต่างที่ปรับ (Delta)</th>
                                    <th style={{ textAlign: "left", padding: "10px 8px" }}>หมายเหตุ</th>
                                    <th style={{ textAlign: "left", padding: "10px 8px" }}>ผู้ปรับจูน</th>
                                    <th style={{ textAlign: "center", padding: "10px 8px" }}>รหัสอ้างอิง</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeAccount.adjustments.map((adj) => (
                                    <tr key={adj.id} style={{ borderBottom: "1px solid var(--theme-border-subtle)" }}>
                                        <td style={{ padding: "12px 8px", color: "var(--theme-text-primary)" }}>
                                            {new Date(adj.timestamp).toLocaleString("th-TH")}
                                        </td>
                                        <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                                            <span style={{ color: adj.diffFee >= 0 ? "#10b981" : "#ef4444" }}>
                                                {adj.diffFee >= 0 ? `+ ฿ ${adj.diffFee.toFixed(2)}` : `- ฿ ${Math.abs(adj.diffFee).toFixed(2)}`}
                                            </span>
                                        </td>
                                        <td style={{ padding: "12px 8px", color: "var(--theme-text-secondary)" }}>
                                            {adj.note}
                                        </td>
                                        <td style={{ padding: "12px 8px", color: "var(--theme-text-muted)" }}>
                                            {adj.tunedBy}
                                        </td>
                                        <td style={{ padding: "12px 8px", textAlign: "center", fontFamily: "monospace", fontSize: "0.8rem", color: "var(--theme-text-muted)" }}>
                                            {adj.transactionId ? `${adj.transactionId.slice(0, 10)}...` : adj.id.slice(0, 8)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
