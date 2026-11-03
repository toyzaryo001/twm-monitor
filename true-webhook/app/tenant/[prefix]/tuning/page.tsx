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

    // Form inputs
    const [targetReceiveCount, setTargetReceiveCount] = useState<string>("");
    const [targetFeeAmount, setTargetFeeAmount] = useState<string>("");
    const [targetFeeCount, setTargetFeeCount] = useState<string>("");
    const [note, setNote] = useState<string>("");

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

    // Sync form values when activeAccount changes
    useEffect(() => {
        if (!activeAccount) return;

        // Default targets: from config if present, or from current system
        if (activeAccount.tuningConfig?.targetFeeAmount != null) {
            setTargetFeeAmount(String(activeAccount.currentFeeTotal));
            setTargetReceiveCount(String(activeAccount.currentReceiveCount));
            setTargetFeeCount(String(activeAccount.currentFeeCount));
        } else {
            setTargetFeeAmount(String(activeAccount.currentFeeTotal || ""));
            setTargetReceiveCount(String(activeAccount.currentReceiveCount || ""));
            setTargetFeeCount(String(activeAccount.currentFeeCount || ""));
        }
        setNote(`ปรับจูนให้ตรงกับหน้าแอป TrueMoney ณ ${new Date().toLocaleDateString("th-TH")}`);
    }, [activeAccount]);

    const handleReceiveCountChange = (val: string) => {
        setTargetReceiveCount(val);
        const num = parseInt(val, 10);
        if (!isNaN(num)) {
            // TrueMoney fee starts from 101st transaction
            const autoFeeCount = Math.max(0, num - 100);
            setTargetFeeCount(String(autoFeeCount));
        }
    };

    const targetFeeNum = parseFloat(targetFeeAmount) || 0;
    const currentFeeNum = activeAccount ? activeAccount.currentFeeTotal : 0;
    const feeDiff = Math.round((targetFeeNum - currentFeeNum) * 100) / 100;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeAccount) return;

        if (isNaN(targetFeeNum) || targetFeeNum < 0) {
            showToast({ type: "error", title: "ข้อมูลไม่ถูกต้อง", message: "กรุณาระบุยอดค่าธรรมเนียมที่ถูกต้อง" });
            return;
        }

        const confirmMsg = `ยืนยันการปรับจูนวอลเล็ท "${activeAccount.name}"?\n` +
            `• ยอดค่าธรรมเนียมเป้าหมาย: ฿ ${targetFeeNum.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n` +
            `• ส่วนต่างที่จะปรับปรุง: ${feeDiff >= 0 ? "+" : ""}${feeDiff.toFixed(2)} บาท\n` +
            `• รายการรับเงินโอนสะสม: ${targetReceiveCount || "-"} ครั้ง\n\n` +
            `ระบบจะนับต่อและบวกเพิ่มต่อจากยอดที่ปรับนี้ทันที`;

        if (!confirm(confirmMsg)) return;

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
                    targetFeeAmount: targetFeeNum,
                    targetFeeCount: parseInt(targetFeeCount, 10) || 0,
                    targetReceiveCount: parseInt(targetReceiveCount, 10) || 0,
                    note: note.trim()
                })
            });

            const data = await res.json();
            if (data.ok) {
                showToast({
                    type: "success",
                    title: "ปรับจูนสำเร็จ",
                    message: `ปรับยอดค่าธรรมเนียมเป็น ฿ ${targetFeeNum.toLocaleString("th-TH", { minimumFractionDigits: 2 })} เรียบร้อยแล้ว`
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
            <div className="flex-center" style={{ padding: 80 }}>
                <div className="spinner" />
            </div>
        );
    }

    if (accounts.length === 0) {
        return (
            <div className="tenant-card" style={{ textAlign: "center", padding: 60 }}>
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
        <div style={{ maxWidth: 1080, margin: "0 auto", paddingBottom: 60 }}>
            {/* Page Header */}
            <div className="tenant-page-header" style={{ marginBottom: 24 }}>
                <div>
                    <h1 className="tenant-page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="21" x2="4" y2="14" />
                            <line x1="4" y1="10" x2="4" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12" y2="3" />
                            <line x1="20" y1="21" x2="20" y2="16" />
                            <line x1="20" y1="12" x2="20" y2="3" />
                            <line x1="1" y1="14" x2="7" y2="14" />
                            <line x1="9" y1="8" x2="15" y2="8" />
                            <line x1="17" y1="16" x2="23" y2="16" />
                        </svg>
                        ปรับจูนข้อมูล (Calibration)
                    </h1>
                    <div style={{ fontSize: "0.9rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                        ปรับปรุงยอดยกมารายการค่าธรรมเนียมและจำนวนครั้งรับเงินโอนให้ตรงกับหน้าแอป TrueMoney โดยระบบจะนับต่อและเพิ่มต่อจากยอดที่ปรับจูนโดยอัตโนมัติ
                    </div>
                </div>
            </div>

            {/* Wallet Selector Tabs */}
            {accounts.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
                    {accounts.map(acc => (
                        <button
                            key={acc.id}
                            type="button"
                            onClick={() => setSelectedAccountId(acc.id)}
                            className={`tenant-btn ${acc.id === selectedAccountId ? "tenant-btn-primary" : "tenant-btn-secondary"}`}
                            style={{ padding: "8px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}
                        >
                            <span>{acc.name}</span>
                            <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>({acc.phoneNumber || "-"})</span>
                        </button>
                    ))}
                </div>
            )}

            {activeAccount && (
                <form onSubmit={handleSubmit}>
                    {/* Active Wallet Overview Bar */}
                    <div className="tenant-card" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                        <div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--theme-text-primary)" }}>
                                บัญชี: {activeAccount.name}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--theme-text-muted)" }}>
                                เบอร์โทร: {activeAccount.phoneNumber || "ไม่ระบุ"} | สถานะ: {activeAccount.isActive ? "ใช้งานปกติ" : "ปิดใช้งาน"}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "0.8rem", color: "var(--theme-text-muted)" }}>ค่าธรรมเนียมในระบบปัจจุบัน</div>
                                <div style={{ fontFamily: "monospace", fontSize: "1.2rem", fontWeight: 700, color: "var(--theme-text-primary)" }}>
                                    ฿ {activeAccount.currentFeeTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div style={{ textAlign: "right", borderLeft: "1px solid var(--theme-border-subtle)", paddingLeft: 16 }}>
                                <div style={{ fontSize: "0.8rem", color: "var(--theme-text-muted)" }}>รายการค่าธรรมเนียม</div>
                                <div style={{ fontFamily: "monospace", fontSize: "1.2rem", fontWeight: 700, color: "var(--theme-text-primary)" }}>
                                    {activeAccount.currentFeeCount} รายการ
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tuning Input Cards Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 24 }}>
                        {/* Section 1: Transfer Received Quota (จำนวนครั้งรับเงินโอน) */}
                        <div className="tenant-card" style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: "1.2rem" }}>📥</span>
                                <div>
                                    <div style={{ fontWeight: 600, color: "var(--theme-text-primary)", fontSize: "1rem" }}>
                                        รายการรับเงินโอนสะสมในเดือนนี้
                                    </div>
                                    <div style={{ fontSize: "0.8rem", color: "var(--theme-text-muted)" }}>
                                        ตรงกับตัวเลข "รับเงินโอนจากบัญชีทรูมันนี่อื่นแล้ว X / 100 ครั้ง"
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: "var(--theme-surface-hover)", padding: 12, borderRadius: 8, marginBottom: 16, border: "1px solid var(--theme-border-subtle)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                                    <span style={{ color: "var(--theme-text-secondary)" }}>จำนวนครั้งในระบบตอนนี้:</span>
                                    <span style={{ fontWeight: 600, color: "var(--theme-text-primary)", fontFamily: "monospace" }}>
                                        {activeAccount.currentReceiveCount} ครั้ง
                                    </span>
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--theme-text-muted)" }}>
                                    * โควตาฟรี 100 ครั้งแรกต่อเดือน | ครั้งที่ 101 เป็นต้นไปคิด 2.9% (ไม่เกิน 20 บ./รายการ)
                                </div>
                            </div>

                            <div className="tenant-form-group" style={{ marginBottom: 12 }}>
                                <label className="tenant-form-label">
                                    จำนวนครั้งรับเงินโอนเป้าหมาย (จากหน้าแอป)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="tenant-form-input"
                                    value={targetReceiveCount}
                                    onChange={(e) => handleReceiveCountChange(e.target.value)}
                                    placeholder="เช่น 608"
                                    style={{ fontSize: "1.1rem", fontFamily: "monospace" }}
                                />
                            </div>

                            <div style={{ fontSize: "0.82rem", color: "var(--theme-text-secondary)", marginTop: "auto" }}>
                                คำนวณรายการที่เกินโควตาฟรี:{" "}
                                <strong style={{ color: "var(--theme-text-primary)", fontFamily: "monospace" }}>
                                    {Math.max(0, (parseInt(targetReceiveCount, 10) || 0) - 100)} รายการ
                                </strong>
                            </div>
                        </div>

                        {/* Section 2: Fee Paid Tuning (ค่าธรรมเนียมรับเงินโอนที่จ่ายแล้ว) */}
                        <div className="tenant-card" style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: "1.2rem" }}>💸</span>
                                <div>
                                    <div style={{ fontWeight: 600, color: "var(--theme-text-primary)", fontSize: "1rem" }}>
                                        ค่าธรรมเนียมรับเงินโอนที่จ่ายแล้ว
                                    </div>
                                    <div style={{ fontSize: "0.8rem", color: "var(--theme-text-muted)" }}>
                                        ตรงกับตัวเลข "จ่ายค่าธรรมเนียมแล้ว ฿ X,XXX.XX" ในหน้าแอป
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: "var(--theme-surface-hover)", padding: 12, borderRadius: 8, marginBottom: 16, border: "1px solid var(--theme-border-subtle)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                                    <span style={{ color: "var(--theme-text-secondary)" }}>ยอดในระบบตอนนี้:</span>
                                    <span style={{ fontWeight: 600, color: "var(--theme-text-primary)", fontFamily: "monospace" }}>
                                        ฿ {activeAccount.currentFeeTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                                    <span style={{ color: "var(--theme-text-secondary)" }}>ส่วนต่างที่จะปรับปรุง:</span>
                                    <span style={{
                                        fontWeight: 700,
                                        fontFamily: "monospace",
                                        color: feeDiff > 0 ? "var(--amount-positive, #10b981)" : feeDiff < 0 ? "var(--amount-negative, #ef4444)" : "var(--theme-text-muted)"
                                    }}>
                                        {feeDiff > 0 ? `+ ฿ ${feeDiff.toFixed(2)}` : feeDiff < 0 ? `- ฿ ${Math.abs(feeDiff).toFixed(2)}` : "ตรงกันแล้ว (0.00)"}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
                                <div className="tenant-form-group" style={{ marginBottom: 0 }}>
                                    <label className="tenant-form-label">ยอดเงินค่าธรรมเนียมเป้าหมาย (บาท)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="tenant-form-input"
                                        value={targetFeeAmount}
                                        onChange={(e) => setTargetFeeAmount(e.target.value)}
                                        placeholder="เช่น 1582.34"
                                        required
                                        style={{ fontSize: "1.1rem", fontFamily: "monospace" }}
                                    />
                                </div>
                                <div className="tenant-form-group" style={{ marginBottom: 0 }}>
                                    <label className="tenant-form-label">จำนวนรายการ</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className="tenant-form-input"
                                        value={targetFeeCount}
                                        onChange={(e) => setTargetFeeCount(e.target.value)}
                                        placeholder="เช่น 508"
                                        style={{ fontSize: "1.1rem", fontFamily: "monospace" }}
                                    />
                                </div>
                            </div>

                            <div style={{ fontSize: "0.82rem", color: "var(--theme-text-muted)", marginTop: "auto" }}>
                                ระบบจะสร้างรายการปรับยอดยกมาอัตโนมัติเพื่อให้ยอดรวมค่าธรรมเนียมตรงกับยอดเป้าหมาย
                            </div>
                        </div>
                    </div>

                    {/* Note & Action Card */}
                    <div className="tenant-card" style={{ marginBottom: 30 }}>
                        <div className="tenant-form-group" style={{ marginBottom: 16 }}>
                            <label className="tenant-form-label">หมายเหตุการปรับจูน (บันทึกไว้ตรวจสอบ)</label>
                            <input
                                type="text"
                                className="tenant-form-input"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="เช่น ปรับยอดให้ตรงกับหน้าแอป ณ วันที่ 04/11/2569"
                            />
                        </div>

                        {/* Summary & Guarantee Banner */}
                        <div style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--theme-border-subtle)",
                            borderRadius: 8,
                            padding: 14,
                            marginBottom: 20,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 12
                        }}>
                            <span style={{ fontSize: "1.2rem" }}>⚡</span>
                            <div style={{ fontSize: "0.85rem", color: "var(--theme-text-secondary)", lineHeight: 1.5 }}>
                                <strong>กลไกการนับต่ออัตโนมัติ:</strong> เมื่อกดบันทึกแล้ว ยอดในหน้านี้ หน้าภาพรวม (Dashboard), หน้าวอลเล็ท (Wallets), และหน้าประวัติ (History) จะปรับให้ตรงกับยอดเป้าหมายทันที และเมื่อมี Webhook ธุรกรรมถัดไปส่งเข้ามา ระบบจะ <strong>นับต่อและบวกเพิ่มต่อจากยอดที่ปรับจูนโดยอัตโนมัติ</strong>
                            </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                            <button
                                type="button"
                                className="tenant-btn tenant-btn-secondary"
                                onClick={() => fetchTuningData(false)}
                                disabled={submitting}
                            >
                                รีเฟรชข้อมูล
                            </button>
                            <button
                                type="submit"
                                className="tenant-btn tenant-btn-primary"
                                disabled={submitting}
                                style={{ minWidth: 160, justifyContent: "center" }}
                            >
                                {submitting ? "กำลังบันทึก..." : "💾 บันทึกการปรับจูน"}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* Audit History Table */}
            {activeAccount && activeAccount.adjustments && activeAccount.adjustments.length > 0 && (
                <div className="tenant-card">
                    <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--theme-text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
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
                                            <span style={{ color: adj.diffFee >= 0 ? "var(--amount-positive, #10b981)" : "var(--amount-negative, #ef4444)" }}>
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
