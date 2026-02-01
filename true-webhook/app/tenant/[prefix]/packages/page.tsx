"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useToast } from "../../../components/Toast";

interface Package {
    id: string;
    name: string;
    price: number;
    durationDays: number;
    description: string;
}

interface PaymentRequest {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    package: { name: string; durationDays: number; };
}

export default function TenantPackagesPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const { showToast } = useToast();

    const [packages, setPackages] = useState<Package[]>([]);
    const [pendingRequest, setPendingRequest] = useState<PaymentRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
    const [uploading, setUploading] = useState(false);
    const [bankInfo, setBankInfo] = useState<{ bankName: string; bankAccountNumber: string; bankAccountName: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { fetchData(); }, [prefix]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem("tenantToken");
            const headers = { Authorization: `Bearer ${token}` };

            const [pkgRes, histRes, bankRes] = await Promise.all([
                fetch(`/api/tenant/${prefix}/packages`, { headers }),
                fetch(`/api/tenant/${prefix}/payments/history`, { headers }),
                fetch(`/api/tenant/${prefix}/packages/bank-info`, { headers })
            ]);

            const pkgData = await pkgRes.json();
            const histData = await histRes.json();
            const bankData = await bankRes.json();

            if (pkgData.ok) setPackages(pkgData.data);
            if (bankData.ok) setBankInfo(bankData.data);

            if (histData.ok && histData.data.length > 0) {
                const latest = histData.data[0];
                if (latest.status === "PENDING") setPendingRequest(latest);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !selectedPkg) return;

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("slip", file);
        formData.append("packageId", selectedPkg.id);

        setUploading(true);
        try {
            const token = localStorage.getItem("tenantToken");
            const res = await fetch(`/api/tenant/${prefix}/payments/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const result = await res.json();
            if (result.ok) {
                showToast({ title: "ส่งหลักฐานเรียบร้อย รอตรวจสอบครับ", type: "success" });
                setSelectedPkg(null);
                fetchData();
            } else {
                showToast({ title: result.error || "อัปโหลดล้มเหลว", type: "error" });
            }
        } catch (err) {
            showToast({ title: "Upload failed", type: "error" });
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    // Pending State
    if (pendingRequest) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24 }}>
                <div className="card" style={{ maxWidth: 450, textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: "white", marginBottom: 8 }}>รอตรวจสอบยอดเงิน</h2>
                    <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
                        คุณได้ส่งหลักฐานการโอนเงินสำหรับแพ็คเกจ<br />
                        <span style={{ color: "var(--primary)", fontWeight: 700 }}>{pendingRequest.package.name}</span> เรียบร้อยแล้ว
                    </p>
                    <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, fontSize: 13, color: "var(--text-muted)" }}>
                        แจ้งเมื่อ: {new Date(pendingRequest.createdAt).toLocaleString("th-TH")}
                    </div>
                </div>
            </div>
        );
    }

    // Upload Step
    if (selectedPkg) {
        return (
            <div style={{ padding: 24 }}>
                <div className="page-header" style={{ marginBottom: 24 }}>
                    <button className="btn btn-secondary" onClick={() => setSelectedPkg(null)}>
                        ← ย้อนกลับ
                    </button>
                </div>

                <div className="card" style={{ maxWidth: 800, margin: "0 auto", padding: 32 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>💳 ชำระเงินแพ็คเกจ {selectedPkg.name}</h2>
                    <p style={{ color: "var(--text-muted)", marginBottom: 32 }}>
                        โอนเงิน <strong style={{ color: "var(--success)", fontSize: 20 }}>฿{selectedPkg.price.toLocaleString()}</strong> แล้วแนบสลิปโอนเงิน
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                        {/* Bank Info */}
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "var(--text-muted)" }}>ข้อมูลบัญชีธนาคาร</h3>
                            {bankInfo && bankInfo.bankAccountNumber ? (
                                <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                        <div style={{ width: 40, height: 40, background: "linear-gradient(135deg, #22c55e, #16a34a)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                                            🏦
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: "white" }}>{bankInfo.bankName || "ธนาคาร"}</div>
                                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>กรุณาโอนตามยอดที่ระบุ</div>
                                        </div>
                                    </div>
                                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>เลขบัญชี</div>
                                        <div style={{ fontSize: 22, fontFamily: "monospace", fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>
                                            {bankInfo.bankAccountNumber}
                                        </div>
                                        {bankInfo.bankAccountName && (
                                            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>ชื่อบัญชี: {bankInfo.bankAccountName}</div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, textAlign: "center", color: "var(--text-muted)" }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
                                    <div>ยังไม่ได้ตั้งค่าบัญชีรับเงิน</div>
                                    <div style={{ fontSize: 13 }}>กรุณาติดต่อผู้ดูแลระบบ</div>
                                </div>
                            )}
                        </div>

                        {/* Upload Area */}
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "var(--text-muted)" }}>แนบสลิปโอนเงิน</h3>
                            <div
                                onClick={() => !uploading && fileInputRef.current?.click()}
                                style={{
                                    border: "2px dashed var(--border)",
                                    borderRadius: 16,
                                    padding: 40,
                                    textAlign: "center",
                                    cursor: uploading ? "default" : "pointer",
                                    background: "var(--bg-secondary)",
                                    transition: "all 0.2s",
                                    opacity: uploading ? 0.6 : 1
                                }}
                            >
                                <div style={{ fontSize: 48, marginBottom: 12 }}>{uploading ? "⏳" : "📤"}</div>
                                <div style={{ color: "white", fontWeight: 500, marginBottom: 4 }}>
                                    {uploading ? "กำลังอัปโหลด..." : "คลิกเพื่อเลือกไฟล์"}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>รองรับ: JPG, PNG</div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: "none" }}
                                accept="image/*"
                                onChange={handleUpload}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Package Selection
    return (
        <div style={{ padding: 24 }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">เลือกแพ็คเกจต่ออายุ</h1>
                    <p style={{ color: "var(--text-muted)", marginTop: 4 }}>เลือกแผนที่เหมาะสมกับการใช้งานของคุณ</p>
                </div>
            </div>

            {packages.length === 0 ? (
                <div className="card empty-state">ยังไม่มีแพ็คเกจที่เปิดขาย</div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24, marginTop: 24 }}>
                    {packages.map((pkg, index) => (
                        <div
                            key={pkg.id}
                            className="card"
                            style={{
                                padding: 0,
                                overflow: "hidden",
                                border: index === 0 ? "2px solid var(--primary)" : undefined,
                                position: "relative"
                            }}
                        >
                            {/* Popular Badge */}
                            {index === 0 && packages.length > 1 && (
                                <div style={{
                                    position: "absolute",
                                    top: 16,
                                    right: 16,
                                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                                    color: "white",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "4px 10px",
                                    borderRadius: 20
                                }}>
                                    ⭐ แนะนำ
                                </div>
                            )}

                            {/* Header */}
                            <div style={{ padding: "24px 24px 0" }}>
                                <h3 style={{ fontSize: 20, fontWeight: 700, color: "white", marginBottom: 12 }}>{pkg.name}</h3>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: 36, fontWeight: 800, color: "var(--primary)" }}>
                                        ฿{pkg.price.toLocaleString()}
                                    </span>
                                </div>
                                <div style={{
                                    display: "inline-block",
                                    background: "rgba(99, 102, 241, 0.15)",
                                    color: "var(--primary)",
                                    padding: "4px 12px",
                                    borderRadius: 20,
                                    fontSize: 13,
                                    fontWeight: 500
                                }}>
                                    {pkg.durationDays} วัน
                                </div>
                            </div>

                            {/* Features */}
                            <div style={{ padding: 24, minHeight: 120 }}>
                                {pkg.description ? (
                                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                        {pkg.description.split("\n").map((line, i) => (
                                            <li key={i} style={{
                                                display: "flex",
                                                alignItems: "flex-start",
                                                gap: 10,
                                                marginBottom: 10,
                                                color: "var(--text-muted)",
                                                fontSize: 14
                                            }}>
                                                <span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>
                                                {line}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 14 }}>ไม่มีรายละเอียดเพิ่มเติม</p>
                                )}
                            </div>

                            {/* CTA Button */}
                            <div style={{ padding: "0 24px 24px" }}>
                                <button
                                    onClick={() => setSelectedPkg(pkg)}
                                    className="btn btn-primary"
                                    style={{
                                        width: "100%",
                                        padding: "14px 24px",
                                        fontSize: 15,
                                        fontWeight: 600
                                    }}
                                >
                                    เลือกแพ็คเกจนี้
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
