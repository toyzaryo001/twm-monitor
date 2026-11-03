"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useToast } from "../../../components/Toast";

interface AccountOption {
    id: string;
    name: string;
    phoneNumber?: string;
    isActive: boolean;
    walletBearerTokenConfigured?: boolean;
    slipVerifyTokenConfigured?: boolean;
    walletBearerToken?: string;
    slipVerifyToken?: string;
}

interface SlipRecord {
    id: string;
    transactionId?: string | null;
    accountId: string;
    amount: number;
    amountSatang: number;
    receiverMobile: string;
    senderMobile?: string | null;
    transactionDate: string;
    status: "VALID" | "INVALID";
    resultMessage?: string | null;
    slipImageUrl?: string | null;
    verifiedBy?: string | null;
    verifiedAt: string;
    account?: {
        name: string;
        phoneNumber?: string;
    };
}

interface SlipStats {
    totalCount: number;
    validCount: number;
    invalidCount: number;
    todayValidAmount: number;
}

function getTodayDateTimeLocal(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export default function TenantSlipsPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const { showToast } = useToast();

    // Accounts & Statistics
    const [accounts, setAccounts] = useState<AccountOption[]>([]);
    const [stats, setStats] = useState<SlipStats>({
        totalCount: 0,
        validCount: 0,
        invalidCount: 0,
        todayValidAmount: 0,
    });

    // Verification Form State
    const [selectedAccountId, setSelectedAccountId] = useState<string>("");
    const [receiverMobile, setReceiverMobile] = useState<string>("");
    const [amount, setAmount] = useState<string>("");
    const [transactionId, setTransactionId] = useState<string>("");
    const [transactionDate, setTransactionDate] = useState<string>(getTodayDateTimeLocal());
    const [senderMobile, setSenderMobile] = useState<string>("");
    const [slipImageUrl, setSlipImageUrl] = useState<string>("");
    const [uploadingImage, setUploadingImage] = useState(false);

    // Submission & Result State
    const [verifying, setVerifying] = useState(false);
    const [latestResult, setLatestResult] = useState<{
        status: "VALID" | "INVALID";
        message: string;
        data?: any;
    } | null>(null);

    // History Table State
    const [history, setHistory] = useState<SlipRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);

    // Slip Preview Modal
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Fetch accounts
    const loadAccounts = useCallback(async () => {
        try {
            const token = localStorage.getItem("tenantToken");
            const res = await fetch(`/api/tenant/${prefix}/accounts`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
            if (data.ok && Array.isArray(data.data)) {
                setAccounts(data.data);
                if (data.data.length > 0 && !selectedAccountId) {
                    const first = data.data[0];
                    setSelectedAccountId(first.id);
                    if (first.phoneNumber) {
                        setReceiverMobile(first.phoneNumber);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to load accounts:", err);
        }
    }, [prefix, selectedAccountId]);

    // Fetch quick stats
    const loadStats = useCallback(async () => {
        try {
            const token = localStorage.getItem("tenantToken");
            const res = await fetch(`/api/tenant/${prefix}/slips/stats`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
            if (data.ok && data.data) {
                setStats(data.data);
            }
        } catch (err) {
            console.error("Failed to load stats:", err);
        }
    }, [prefix]);

    // Fetch history
    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const token = localStorage.getItem("tenantToken");
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: "15",
            });
            if (statusFilter !== "ALL") queryParams.set("status", statusFilter);
            if (searchQuery.trim()) queryParams.set("q", searchQuery.trim());

            const res = await fetch(`/api/tenant/${prefix}/slips/history?${queryParams.toString()}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
            if (data.ok && Array.isArray(data.data)) {
                setHistory(data.data);
                if (data.pagination) {
                    setTotalPages(data.pagination.totalPages || 1);
                }
            }
        } catch (err) {
            console.error("Failed to load slips history:", err);
        } finally {
            setHistoryLoading(false);
        }
    }, [prefix, page, statusFilter, searchQuery]);

    useEffect(() => {
        loadAccounts();
        loadStats();
    }, [loadAccounts, loadStats]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Auto-update receiver phone when account selection changes
    const handleAccountChange = (accId: string) => {
        setSelectedAccountId(accId);
        const acc = accounts.find(a => a.id === accId);
        if (acc?.phoneNumber) {
            setReceiverMobile(acc.phoneNumber);
        }
    };

    // Upload image helper
    const handleUploadFile = async (file: File) => {
        setUploadingImage(true);
        try {
            const token = localStorage.getItem("tenantToken");
            const formData = new FormData();
            formData.append("slip", file);

            const res = await fetch(`/api/tenant/${prefix}/slips/upload`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });

            const data = await res.json();
            if (data.ok && data.data?.imageUrl) {
                setSlipImageUrl(data.data.imageUrl);
                showToast({ type: "success", title: "อัปโหลดสำเร็จ", message: "อัปโหลดรูปภาพสลิปเรียบร้อย" });
            } else {
                showToast({ type: "error", title: "อัปโหลดไม่สำเร็จ", message: data.error || "อัปโหลดรูปภาพไม่สำเร็จ" });
            }
        } catch (err: any) {
            showToast({ type: "error", title: "ข้อผิดพลาด", message: "เกิดข้อผิดพลาดในการอัปโหลดรูป" });
        } finally {
            setUploadingImage(false);
        }
    };

    // Global Paste (Ctrl+V) listener for slips
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        handleUploadFile(file);
                        break;
                    }
                }
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [prefix]);

    // Handle Verify Submit
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!receiverMobile.trim()) {
            showToast({ type: "error", title: "ข้อมูลไม่ครบ", message: "กรุณาระบุเบอร์ผู้รับเงิน" });
            return;
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            showToast({ type: "error", title: "ข้อมูลไม่ครบ", message: "กรุณากรอกยอดเงินให้ถูกต้อง" });
            return;
        }

        if (!transactionDate.trim()) {
            showToast({ type: "error", title: "ข้อมูลไม่ครบ", message: "กรุณาระบุวันเวลาทำรายการ (yyyy-mm-dd HH:mm)" });
            return;
        }

        setVerifying(true);
        setLatestResult(null);

        try {
            const token = localStorage.getItem("tenantToken");
            const res = await fetch(`/api/tenant/${prefix}/slips/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    accountId: selectedAccountId || undefined,
                    receiverMobile: receiverMobile.trim(),
                    amount: numAmount,
                    transactionDate: transactionDate.trim(),
                    transactionId: transactionId.trim() || undefined,
                    senderMobile: senderMobile.trim() || undefined,
                    slipImageUrl: slipImageUrl || undefined,
                }),
            });

            const data = await res.json();

            if (data.status === "VALID") {
                setLatestResult({
                    status: "VALID",
                    message: data.message || "สลิปจริง 100% (ผ่านการตรวจสอบจาก TrueMoney)",
                    data: data.data,
                });
                showToast({ type: "success", title: "สลิปจริง 100%!", message: data.message });
            } else {
                setLatestResult({
                    status: "INVALID",
                    message: data.message || "ข้อมูลในสลิปไม่ตรงกับฐานข้อมูล TrueMoney (สลิปปลอม)",
                    data: data.data,
                });
                showToast({ type: "error", title: "สลิปไม่ถูกต้อง / ปลอมแปลง", message: data.message });
            }

            // Refresh stats and history
            loadStats();
            loadHistory();
        } catch (err: any) {
            showToast({ type: "error", title: "เชื่อมต่อล้มเหลว", message: "ไม่สามารถเชื่อมต่อระบบตรวจสอบสลิปได้" });
        } finally {
            setVerifying(false);
        }
    };

    const handleResetForm = () => {
        setAmount("");
        setTransactionId("");
        setTransactionDate(getTodayDateTimeLocal());
        setSenderMobile("");
        setSlipImageUrl("");
        setLatestResult(null);
    };

    return (
        <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 60 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 className="tenant-page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span>🔍</span> ตรวจสอบสลิป (จริง / ปลอม)
                    </h1>
                    <div style={{ color: "var(--theme-text-muted)", fontSize: "0.88rem", marginTop: 4 }}>
                        เช็คความถูกต้องของสลิปโอนเงิน TrueMoney แบบ Real-time ยืนยันได้ทันทีว่าจริงหรือปลอม และชี้ชัดส่วนที่ไม่ตรง
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                        onClick={() => { loadStats(); loadHistory(); }}
                        style={{ height: 34, fontSize: "0.82rem" }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                        </svg>
                        รีเฟรชข้อมูล
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar (Focused on Real vs Fake) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
                <div className="tenant-card" style={{ padding: "16px 18px", borderLeft: "4px solid #10b981" }}>
                    <div style={{ color: "var(--theme-text-muted)", fontSize: "0.78rem", fontWeight: 600 }}>ยอดสลิปจริงวันนี้</div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.45rem", fontWeight: 700, color: "#34d399", marginTop: 4 }}>
                        ฿ {stats.todayValidAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--theme-text-secondary)", marginTop: 4 }}>ยอดเงินที่ยืนยันว่าเข้าจริงวันนี้</div>
                </div>

                <div className="tenant-card" style={{ padding: "16px 18px", borderLeft: "4px solid #38bdf8" }}>
                    <div style={{ color: "var(--theme-text-muted)", fontSize: "0.78rem", fontWeight: 600 }}>สลิปที่ตรวจทั้งหมด</div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.45rem", fontWeight: 700, color: "var(--theme-text-primary)", marginTop: 4 }}>
                        {stats.totalCount.toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>รายการ</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--theme-text-secondary)", marginTop: 4 }}>ประวัติการตรวจทั้งหมดในระบบ</div>
                </div>

                <div className="tenant-card" style={{ padding: "16px 18px", borderLeft: "4px solid #10b981" }}>
                    <div style={{ color: "var(--theme-text-muted)", fontSize: "0.78rem", fontWeight: 600 }}>สลิปจริง (ผ่าน 100%)</div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.45rem", fontWeight: 700, color: "#34d399", marginTop: 4 }}>
                        {stats.validCount.toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>รายการ</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--theme-text-secondary)", marginTop: 4 }}>ข้อมูลตรงกับระบบ TrueMoney</div>
                </div>

                <div className="tenant-card" style={{ padding: "16px 18px", borderLeft: "4px solid #f43f5e" }}>
                    <div style={{ color: "var(--theme-text-muted)", fontSize: "0.78rem", fontWeight: 600 }}>สลิปไม่ผ่าน / สลิปปลอม</div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.45rem", fontWeight: 700, color: "#f87171", marginTop: 4 }}>
                        {stats.invalidCount.toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>รายการ</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--theme-text-secondary)", marginTop: 4 }}>ตรวจพบข้อมูลไม่ตรง / สลิปปลอม</div>
                </div>
            </div>

            {/* Main Interactive Checker Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 480px) 1fr", gap: 24, marginBottom: 32 }}>
                {/* Form Panel */}
                <div className="tenant-card" style={{ padding: "20px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--theme-text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                            <span>📋</span> กรอกข้อมูลหรือวางรูปสลิป
                        </div>
                        <span style={{ fontSize: "0.75rem", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>
                            กด Ctrl + V วางรูปได้ทันที
                        </span>
                    </div>

                    {/* Image Dropzone / Preview */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: "2px dashed var(--theme-border-subtle)",
                            borderRadius: 10,
                            padding: "16px",
                            textAlign: "center",
                            background: slipImageUrl ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.02)",
                            cursor: "pointer",
                            marginBottom: 18,
                            position: "relative",
                            transition: "all 0.2s ease",
                        }}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadFile(file);
                            }}
                        />

                        {uploadingImage ? (
                            <div style={{ padding: "20px 0", color: "var(--theme-text-secondary)", fontSize: "0.85rem" }}>
                                <span className="spinner" style={{ width: 18, height: 18, margin: "0 auto 8px auto", display: "block" }}></span>
                                กำลังอัปโหลดรูปภาพสลิป...
                            </div>
                        ) : slipImageUrl ? (
                            <div style={{ position: "relative" }}>
                                <img
                                    src={slipImageUrl}
                                    alt="สลิปที่อัปโหลด"
                                    style={{ maxHeight: 180, maxWidth: "100%", borderRadius: 6, margin: "0 auto", display: "block", objectFit: "contain" }}
                                />
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSlipImageUrl("");
                                    }}
                                    style={{
                                        position: "absolute",
                                        top: 4,
                                        right: 4,
                                        background: "rgba(239, 68, 68, 0.85)",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "50%",
                                        width: 24,
                                        height: 24,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 12,
                                    }}
                                    title="ลบรูปภาพ"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div style={{ padding: "12px 0" }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--theme-text-muted)" strokeWidth="1.5" style={{ margin: "0 auto 6px auto", display: "block" }}>
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                                <div style={{ fontSize: "0.85rem", color: "var(--theme-text-primary)", fontWeight: 500 }}>
                                    คลิกเพื่ออัปโหลดรูป หรือ กด Ctrl + V วางรูปสลิป
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                                    รองรับ JPG, PNG, WEBP (สูงสุด 10MB)
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Manual Form */}
                    <form onSubmit={handleVerify}>
                        {/* Select Wallet */}
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 6 }}>
                                วอลเล็ทผู้รับเงินในระบบ *
                            </label>
                            <select
                                className="tenant-input"
                                value={selectedAccountId}
                                onChange={(e) => handleAccountChange(e.target.value)}
                                style={{ width: "100%", height: 38, fontSize: "0.85rem" }}
                            >
                                {accounts.map((acc) => {
                                    const hasToken = Boolean(acc.slipVerifyTokenConfigured || acc.slipVerifyToken || acc.walletBearerTokenConfigured || acc.walletBearerToken);
                                    return (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} ({acc.phoneNumber || "ไม่ระบุเบอร์"}) {!hasToken ? "⚠️ ยังไม่ตั้งค่า Key ตรวจสอบสลิป" : "⚡ พร้อมตรวจสลิป"}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Receiver Mobile & Amount */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 6 }}>
                                    เบอร์ผู้รับ (10 หรือ 4 ตัวท้าย) *
                                </label>
                                <input
                                    type="text"
                                    className="tenant-input"
                                    placeholder="08xxxxxxxx"
                                    value={receiverMobile}
                                    onChange={(e) => setReceiverMobile(e.target.value)}
                                    style={{ width: "100%", height: 38, fontSize: "0.85rem", fontFamily: "monospace" }}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 6 }}>
                                    ยอดเงิน (บาท) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="tenant-input"
                                    placeholder="150.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    style={{ width: "100%", height: 38, fontSize: "0.85rem", fontFamily: "monospace", fontWeight: 600 }}
                                    required
                                />
                            </div>
                        </div>

                        {/* Transaction ID & Date */}
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 6 }}>
                                เลขที่รายการ TrueMoney (Transaction ID 14 หลัก)
                            </label>
                            <input
                                type="text"
                                className="tenant-input"
                                placeholder="50027287091246 (แนะนำให้กรอกเพื่อความแม่นยำ 100%)"
                                value={transactionId}
                                onChange={(e) => setTransactionId(e.target.value)}
                                style={{ width: "100%", height: 38, fontSize: "0.85rem", fontFamily: "monospace" }}
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 10, marginBottom: 18 }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 6 }}>
                                    วันเวลาทำรายการ (yyyy-mm-dd HH:mm) *
                                </label>
                                <input
                                    type="text"
                                    className="tenant-input"
                                    placeholder="2026-11-04 14:30"
                                    value={transactionDate}
                                    onChange={(e) => setTransactionDate(e.target.value)}
                                    style={{ width: "100%", height: 38, fontSize: "0.85rem", fontFamily: "monospace" }}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 6 }}>
                                    เบอร์ผู้โอน (ถ้ามี)
                                </label>
                                <input
                                    type="text"
                                    className="tenant-input"
                                    placeholder="08xxxxxxxx"
                                    value={senderMobile}
                                    onChange={(e) => setSenderMobile(e.target.value)}
                                    style={{ width: "100%", height: 38, fontSize: "0.85rem", fontFamily: "monospace" }}
                                />
                            </div>
                        </div>

                        {/* Submit Actions */}
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                type="submit"
                                className="tenant-btn tenant-btn-primary"
                                disabled={verifying}
                                style={{ flex: 1, height: 40, fontSize: "0.88rem", fontWeight: 600, justifyContent: "center" }}
                            >
                                {verifying ? (
                                    <>
                                        <span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }}></span>
                                        กำลังตรวจสอบกับ TrueMoney...
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                                            <circle cx="11" cy="11" r="8" />
                                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                        ตรวจสอบสลิป
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                className="tenant-btn tenant-btn-secondary"
                                onClick={handleResetForm}
                                style={{ height: 40, padding: "0 14px", fontSize: "0.82rem" }}
                            >
                                ล้างฟอร์ม
                            </button>
                        </div>
                    </form>
                </div>

                {/* Live Diagnostic Result Card */}
                <div>
                    {latestResult ? (
                        <div
                            className="tenant-card"
                            style={{
                                padding: "24px",
                                border: `1.5px solid ${
                                    latestResult.status === "VALID"
                                        ? "rgba(16, 185, 129, 0.45)"
                                        : "rgba(239, 68, 68, 0.45)"
                                }`,
                                background:
                                    latestResult.status === "VALID"
                                        ? "linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, rgba(0, 0, 0, 0.25) 100%)"
                                        : "linear-gradient(180deg, rgba(239, 68, 68, 0.1) 0%, rgba(0, 0, 0, 0.25) 100%)",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            {/* Status Header */}
                            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                                <div
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 24,
                                        fontWeight: 700,
                                        background:
                                            latestResult.status === "VALID"
                                                ? "rgba(16, 185, 129, 0.2)"
                                                : "rgba(239, 68, 68, 0.2)",
                                        color: latestResult.status === "VALID" ? "#10b981" : "#ef4444",
                                        border: `1.5px solid ${
                                            latestResult.status === "VALID" ? "#10b981" : "#ef4444"
                                        }`,
                                    }}
                                >
                                    {latestResult.status === "VALID" ? "✓" : "✕"}
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: "1.25rem",
                                            fontWeight: 700,
                                            color: latestResult.status === "VALID" ? "#34d399" : "#f87171",
                                        }}
                                    >
                                        {latestResult.status === "VALID"
                                            ? "สลิปจริง 100% (ผ่านการตรวจสอบ)"
                                            : "สลิปไม่ถูกต้อง / ปลอมแปลง"}
                                    </div>
                                    <div style={{ fontSize: "0.88rem", color: "var(--theme-text-secondary)", marginTop: 3 }}>
                                        {latestResult.message}
                                    </div>
                                </div>
                            </div>

                            {/* Details Breakdown */}
                            <div
                                style={{
                                    background: "rgba(0, 0, 0, 0.35)",
                                    borderRadius: 10,
                                    padding: "16px 18px",
                                    border: "1px solid var(--theme-border-subtle)",
                                    marginBottom: 16,
                                }}
                            >
                                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-muted)", marginBottom: 10 }}>
                                    ข้อมูลสลิปที่ส่งตรวจสอบ:
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.85rem" }}>
                                    <div>
                                        <span style={{ color: "var(--theme-text-muted)" }}>ยอดเงิน:</span>
                                        <div style={{ fontFamily: "monospace", fontSize: "1.15rem", fontWeight: 700, color: latestResult.status === "VALID" ? "#34d399" : "#f87171", marginTop: 2 }}>
                                            ฿ {amount ? parseFloat(amount).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "0.00"}
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--theme-text-muted)" }}>เบอร์ผู้รับเงิน:</span>
                                        <div style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--theme-text-primary)", marginTop: 2 }}>
                                            {receiverMobile}
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--theme-text-muted)" }}>เลขที่รายการ TrueMoney:</span>
                                        <div style={{ fontFamily: "monospace", fontWeight: 500, color: "var(--theme-text-primary)", marginTop: 2 }}>
                                            {transactionId || "ไม่ระบุ (ตรวจด้วยวันเวลาและยอดเงิน)"}
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--theme-text-muted)" }}>วันเวลาในสลิป:</span>
                                        <div style={{ fontFamily: "monospace", fontWeight: 500, color: "var(--theme-text-primary)", marginTop: 2 }}>
                                            {transactionDate}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Diagnostic Note */}
                            <div style={{ marginTop: "auto", fontSize: "0.8rem", color: "var(--theme-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                                <span>⚡</span> ผลการตรวจสอบส่งตรงจาก TrueMoney P2P Validate Service แบบ Real-time
                            </div>
                        </div>
                    ) : (
                        <div
                            className="tenant-card"
                            style={{
                                padding: "40px 24px",
                                textAlign: "center",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                minHeight: 320,
                            }}
                        >
                            <div
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: "50%",
                                    background: "rgba(56, 189, 248, 0.08)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 26,
                                    marginBottom: 14,
                                    border: "1px solid rgba(56, 189, 248, 0.2)",
                                }}
                            >
                                🔍
                            </div>
                            <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--theme-text-primary)", marginBottom: 6 }}>
                                ผลการตรวจสอบจะปรากฏที่นี่
                            </div>
                            <div style={{ fontSize: "0.82rem", color: "var(--theme-text-muted)", maxWidth: 380, lineHeight: 1.5 }}>
                                เมื่อกดปุ่ม &quot;ตรวจสอบสลิป&quot; ระบบจะเชื่อมต่อไปยัง TrueMoney P2P Validate v1.6 และแจ้งทันทีว่าสลิปจริงหรือปลอม
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* History Section */}
            <div className="tenant-card" style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--theme-text-primary)" }}>
                            📜 ประวัติการตรวจสอบสลิป
                        </div>
                        <div style={{ color: "var(--theme-text-muted)", fontSize: "0.82rem", marginTop: 2 }}>
                            บันทึกผลการตรวจสอบย้อนหลัง แยกสถานะ สลิปจริง / สลิปไม่ผ่าน พร้อมข้อความวินิจฉัย
                        </div>
                    </div>

                    {/* Filter Tabs & Search */}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.04)", borderRadius: 8, padding: 3, gap: 2 }}>
                            {[
                                { key: "ALL", label: "ทั้งหมด" },
                                { key: "VALID", label: "✅ สลิปจริง" },
                                { key: "INVALID", label: "❌ ไม่ผ่าน/ปลอม" },
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => { setStatusFilter(tab.key); setPage(1); }}
                                    style={{
                                        padding: "4px 10px",
                                        borderRadius: 6,
                                        fontSize: "0.78rem",
                                        fontWeight: statusFilter === tab.key ? 600 : 400,
                                        background: statusFilter === tab.key ? "var(--theme-btn-primary-bg, #10b981)" : "transparent",
                                        color: statusFilter === tab.key ? "#fff" : "var(--theme-text-muted)",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <input
                            type="text"
                            className="tenant-input"
                            placeholder="ค้นหาเลขรายการ / เบอร์..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            style={{ height: 32, fontSize: "0.8rem", width: 180 }}
                        />
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--theme-border-subtle)", textAlign: "left", color: "var(--theme-text-muted)", fontSize: "0.78rem" }}>
                                <th style={{ padding: "10px 12px" }}>วันเวลาที่ตรวจ</th>
                                <th style={{ padding: "10px 12px" }}>วอลเล็ทผู้รับ</th>
                                <th style={{ padding: "10px 12px" }}>เลขที่รายการ TrueMoney</th>
                                <th style={{ padding: "10px 12px", textAlign: "right" }}>ยอดเงิน</th>
                                <th style={{ padding: "10px 12px", textAlign: "center" }}>สถานะ</th>
                                <th style={{ padding: "10px 12px" }}>ผลการวินิจฉัย</th>
                                <th style={{ padding: "10px 12px", textAlign: "center" }}>รูปสลิป</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historyLoading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: "30px 0", textAlign: "center", color: "var(--theme-text-muted)" }}>
                                        <span className="spinner" style={{ width: 18, height: 18, margin: "0 auto 8px auto", display: "block" }}></span>
                                        กำลังโหลดประวัติ...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: "30px 0", textAlign: "center", color: "var(--theme-text-muted)" }}>
                                        ยังไม่มีประวัติการตรวจสอบสลิป
                                    </td>
                                </tr>
                            ) : (
                                history.map((record) => {
                                    const isOk = record.status === "VALID";

                                    return (
                                        <tr key={record.id} style={{ borderBottom: "1px solid var(--theme-border-subtle)" }}>
                                            <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "0.8rem", color: "var(--theme-text-secondary)" }}>
                                                {new Date(record.verifiedAt).toLocaleString("th-TH")}
                                            </td>
                                            <td style={{ padding: "10px 12px" }}>
                                                <div style={{ fontWeight: 500, color: "var(--theme-text-primary)" }}>
                                                    {record.account?.name || "ไม่ระบุ"}
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--theme-text-muted)", fontFamily: "monospace" }}>
                                                    {record.receiverMobile}
                                                </div>
                                            </td>
                                            <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "0.82rem" }}>
                                                {record.transactionId || "-"}
                                            </td>
                                            <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: isOk ? "#34d399" : "#f87171" }}>
                                                ฿ {record.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                <span
                                                    style={{
                                                        display: "inline-block",
                                                        padding: "2px 8px",
                                                        borderRadius: 6,
                                                        fontSize: "0.72rem",
                                                        fontWeight: 600,
                                                        background: isOk ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                                        color: isOk ? "#34d399" : "#f87171",
                                                        border: `1px solid ${isOk ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                                                    }}
                                                >
                                                    {isOk ? "สลิปจริง" : "ไม่ผ่าน"}
                                                </span>
                                            </td>
                                            <td style={{ padding: "10px 12px", color: "var(--theme-text-secondary)", fontSize: "0.8rem", maxWidth: 320 }}>
                                                {record.resultMessage || "-"}
                                            </td>
                                            <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                {record.slipImageUrl ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewImage(record.slipImageUrl!)}
                                                        className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                        style={{ padding: "2px 8px", fontSize: "0.75rem", height: 26 }}
                                                    >
                                                        ดูรูป
                                                    </button>
                                                ) : (
                                                    <span style={{ color: "var(--theme-text-muted)", fontSize: "0.75rem" }}>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 16 }}>
                        <button
                            type="button"
                            className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            style={{ height: 28, fontSize: "0.75rem" }}
                        >
                            ก่อนหน้า
                        </button>
                        <span style={{ fontSize: "0.8rem", color: "var(--theme-text-muted)" }}>
                            หน้า {page} จาก {totalPages}
                        </span>
                        <button
                            type="button"
                            className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            style={{ height: 28, fontSize: "0.75rem" }}
                        >
                            ถัดไป
                        </button>
                    </div>
                )}
            </div>

            {/* Slip Image Preview Modal */}
            {previewImage && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.8)",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: 20,
                    }}
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        style={{
                            maxWidth: 500,
                            maxHeight: "90vh",
                            position: "relative",
                            background: "var(--theme-card-bg, #1e1e24)",
                            borderRadius: 12,
                            padding: 16,
                            overflow: "hidden",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--theme-text-primary)" }}>
                                🖼️ รูปภาพสลิป
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewImage(null)}
                                style={{ background: "transparent", border: "none", color: "var(--theme-text-muted)", fontSize: 18, cursor: "pointer" }}
                            >
                                ✕
                            </button>
                        </div>
                        <img
                            src={previewImage}
                            alt="Slip Full Preview"
                            style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: 8, display: "block", objectFit: "contain" }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
