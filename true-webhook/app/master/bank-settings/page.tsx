"use client";

import { useState, useEffect } from "react";
import { useToast } from "../../components/Toast";

interface BankSettings {
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
}

export default function BankSettingsPage() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<BankSettings>({
        bankName: "",
        bankAccountNumber: "",
        bankAccountName: "",
    });

    const getToken = () => localStorage.getItem("token") || "";

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/master/bank-settings", {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            const data = await res.json();
            if (data.ok) {
                setForm({
                    bankName: data.data.bankName || "",
                    bankAccountNumber: data.data.bankAccountNumber || "",
                    bankAccountName: data.data.bankAccountName || "",
                });
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch("/api/master/bank-settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify(form),
            });

            const data = await res.json();
            if (data.ok) {
                showToast({ type: "success", title: "บันทึกเรียบร้อย", message: "ข้อมูลบัญชีธนาคารถูกบันทึกแล้ว" });
            } else {
                showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: data.error });
            }
        } catch (e) {
            showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: "ไม่สามารถบันทึกข้อมูลได้" });
        }
        setSaving(false);
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">🏦 บัญชีรับเงิน</h1>
                    <p style={{ color: "var(--text-muted)", marginTop: 4 }}>ตั้งค่าบัญชีธนาคารสำหรับรับเงินค่าต่ออายุบริการ</p>
                </div>
            </div>

            <form onSubmit={handleSave}>
                <div className="card" style={{ maxWidth: 600 }}>
                    <h2 style={{ fontSize: 18, marginBottom: 20, color: "#22c55e" }}>ข้อมูลบัญชีธนาคาร</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
                        ข้อมูลนี้จะแสดงให้ลูกค้าเห็นเมื่อต้องการต่ออายุบริการ
                    </p>

                    <div className="form-group">
                        <label className="form-label">ชื่อธนาคาร</label>
                        <input
                            type="text"
                            className="form-input"
                            value={form.bankName}
                            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                            placeholder="เช่น กสิกรไทย, กรุงเทพ, ไทยพาณิชย์"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">เลขบัญชี</label>
                        <input
                            type="text"
                            className="form-input"
                            value={form.bankAccountNumber}
                            onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                            placeholder="เช่น 123-4-56789-0"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">ชื่อบัญชี</label>
                        <input
                            type="text"
                            className="form-input"
                            value={form.bankAccountName}
                            onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
                            placeholder="เช่น บจก. ทรูเว็บฮุก หรือ ชื่อ-นามสกุล"
                        />
                    </div>

                    {/* Preview */}
                    {form.bankName && form.bankAccountNumber && (
                        <div style={{
                            marginTop: 24,
                            padding: 20,
                            background: "rgba(34, 197, 94, 0.1)",
                            borderRadius: 12,
                            border: "1px solid rgba(34, 197, 94, 0.3)"
                        }}>
                            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>ตัวอย่างที่ลูกค้าจะเห็น:</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                    borderRadius: 12,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 22
                                }}>🏦</div>
                                <div>
                                    <div style={{ fontWeight: 600, color: "white", fontSize: 16 }}>{form.bankName}</div>
                                    <div style={{ fontSize: 22, fontFamily: "monospace", color: "#22c55e", fontWeight: 700 }}>{form.bankAccountNumber}</div>
                                    {form.bankAccountName && <div style={{ fontSize: 14, color: "#9ca3af" }}>ชื่อบัญชี: {form.bankAccountName}</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 24 }}>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: "12px 32px" }}>
                            {saving ? "กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
