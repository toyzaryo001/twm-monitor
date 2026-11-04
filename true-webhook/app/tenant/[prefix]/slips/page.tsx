"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
    const [isDragOver, setIsDragOver] = useState(false);

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

    // Helper: Check if an account actually has slipVerifyToken configured
    const hasSlipKeyConfigured = useCallback((acc?: AccountOption | null) => {
        if (!acc) return false;
        return Boolean(acc.slipVerifyTokenConfigured || (acc.slipVerifyToken && acc.slipVerifyToken.trim() !== ""));
    }, []);

    // Currently selected account
    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    const isCurrentAccountReady = hasSlipKeyConfigured(selectedAccount);

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
        const acc = accounts.find((a) => a.id === accId);
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
                showToast({ type: "success", title: "อัปโหลดสำเร็จ", message: "อัปโหลดรูปภาพสลิปเรียบร้อยแล้ว" });
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

        if (!selectedAccount) {
            showToast({ type: "error", title: "เลือกวอลเล็ท", message: "กรุณาเลือกวอลเล็ทผู้รับเงินในระบบ" });
            return;
        }

        if (!isCurrentAccountReady) {
            showToast({
                type: "error",
                title: "ยังไม่ได้ผูก Key ตรวจสอบสลิป",
                message: `วอลเล็ท "${selectedAccount.name}" ยังไม่ได้ผูก Key สำหรับตรวจสลิป กรุณาไปตั้งค่าในหน้าจัดการวอลเล็ทก่อน`,
            });
            return;
        }

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

    // Styling constants for crisp Dark Obsidian Fintech look
    const darkInputStyle: React.CSSProperties = {
        width: "100%",
        height: 40,
        background: "#141417",
        border: "1px solid #27272a",
        borderRadius: 8,
        padding: "0 14px",
        color: "#fafafa",
        fontSize: "0.88rem",
        outline: "none",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    };

    return (
        <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 60 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h1 className="tenant-page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10, fontSize: "1.5rem" }}>
                            <span>🔍</span> ตรวจสอบสลิป (จริง / ปลอม)
                        </h1>
                        <span style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 6,
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "#10b981",
                            border: "1px solid rgba(16, 185, 129, 0.28)",
                            letterSpacing: "0.3px",
                        }}>
                            TrueMoney P2P Validator v1.6
                        </span>
                    </div>
                    <div style={{ color: "var(--theme-text-muted)", fontSize: "0.85rem", marginTop: 6, lineHeight: 1.4 }}>
                        เช็คความถูกต้องของสลิปโอนเงิน TrueMoney แบบ Real-time ยืนยันได้ทันทีว่าจริงหรือปลอม ชี้ชัดส่วนที่ไม่ตรง และป้องกันสลิปตัดต่อ
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <Link
                        href={`/tenant/${prefix}/wallets`}
                        className="tenant-btn tenant-btn-secondary"
                        style={{ height: 36, fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                    >
                        ⚙️ จัดการวอลเล็ท
                    </Link>
                    <button
                        className="tenant-btn tenant-btn-secondary"
                        onClick={() => { loadAccounts(); loadStats(); loadHistory(); }}
                        style={{ height: 36, fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                        </svg>
                        รีเฟรชข้อมูล
                    </button>
                </div>
            </div>

            {/* Quick Metrics Ribbon (Compact Dark Obsidian Fintech) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
                {/* 1. ยอดสลิปจริงวันนี้ */}
                <div style={{
                    background: "#141417",
                    border: "1px solid #27272a",
                    borderRadius: 12,
                    padding: "16px 18px",
                    position: "relative",
                    overflow: "hidden"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>ยอดสลิปจริงวันนี้</span>
                        <span style={{ fontSize: "0.68rem", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>เงินเข้าจริง</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.45rem", fontWeight: 700, color: "#10b981" }}>
                        ฿ {stats.todayValidAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                        ยืนยันยอดเงินสำเร็จวันนี้
                    </div>
                </div>

                {/* 2. สลิปที่ตรวจทั้งหมด */}
                <div style={{
                    background: "#141417",
                    border: "1px solid #27272a",
                    borderRadius: 12,
                    padding: "16px 18px",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>ตรวจทั้งหมด</span>
                        <span style={{ fontSize: "0.68rem", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Total</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.45rem", fontWeight: 700, color: "#fafafa" }}>
                        {stats.totalCount.toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--theme-text-muted)" }}>รายการ</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                        ประวัติการตรวจสอบในระบบ
                    </div>
                </div>

                {/* 3. สลิปจริง (ผ่าน 100%) */}
                <div style={{
                    background: "#141417",
                    border: "1px solid #27272a",
                    borderRadius: 12,
                    padding: "16px 18px",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>สลิปจริง (ผ่าน 100%)</span>
                        <span style={{ fontSize: "0.68rem", background: "rgba(16, 185, 129, 0.12)", color: "#34d399", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Verified</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.45rem", fontWeight: 700, color: "#34d399" }}>
                        {stats.validCount.toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--theme-text-muted)" }}>รายการ</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                        ข้อมูลตรงกับระบบ TrueMoney
                    </div>
                </div>

                {/* 4. สลิปไม่ผ่าน / ปลอม */}
                <div style={{
                    background: "#141417",
                    border: "1px solid #27272a",
                    borderRadius: 12,
                    padding: "16px 18px",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>สลิปไม่ผ่าน / ปลอม</span>
                        <span style={{ fontSize: "0.68rem", background: "rgba(239, 68, 68, 0.12)", color: "#f87171", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Alert</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.45rem", fontWeight: 700, color: "#f87171" }}>
                        {stats.invalidCount.toLocaleString()} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--theme-text-muted)" }}>รายการ</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--theme-text-muted)", marginTop: 4 }}>
                        ตรวจพบข้อมูลไม่ตรง / สลิปปลอม
                    </div>
                </div>
            </div>

            {/* Main Interactive Checker Grid (Left Form vs Right Real-time Diagnostic) */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(330px, 500px) 1fr", gap: 20, marginBottom: 28, alignItems: "stretch" }}>
                {/* Form Panel */}
                <div style={{
                    background: "#141417",
                    border: "1px solid #27272a",
                    borderRadius: 14,
                    padding: "22px 24px",
                    display: "flex",
                    flexDirection: "column"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#fafafa", display: "flex", alignItems: "center", gap: 8 }}>
                            <span>📋</span> กรอกข้อมูลหรือวางรูปสลิป
                        </div>
                        <span style={{
                            fontSize: "0.72rem",
                            background: "rgba(56, 189, 248, 0.1)",
                            color: "#38bdf8",
                            border: "1px solid rgba(56, 189, 248, 0.25)",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontWeight: 500
                        }}>
                            กด Ctrl + V แปะรูปได้ทันที
                        </span>
                    </div>

                    {/* Image Dropzone / Preview */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragOver(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleUploadFile(file);
                        }}
                        style={{
                            border: isDragOver ? "2px dashed #10b981" : "1.5px dashed rgba(255, 255, 255, 0.15)",
                            borderRadius: 10,
                            padding: "16px",
                            textAlign: "center",
                            background: isDragOver ? "rgba(16, 185, 129, 0.05)" : (slipImageUrl ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.02)"),
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
                            <div style={{ padding: "16px 0", color: "var(--theme-text-secondary)", fontSize: "0.85rem" }}>
                                <span className="spinner" style={{ width: 20, height: 20, margin: "0 auto 8px auto", display: "block" }}></span>
                                กำลังอัปโหลดรูปภาพสลิป...
                            </div>
                        ) : slipImageUrl ? (
                            <div style={{ position: "relative" }}>
                                <img
                                    src={slipImageUrl}
                                    alt="สลิปที่อัปโหลด"
                                    style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 6, margin: "0 auto", display: "block", objectFit: "contain" }}
                                />
                                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewImage(slipImageUrl);
                                        }}
                                        className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                        style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                                    >
                                        🔍 ดูรูปเต็ม
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSlipImageUrl("");
                                        }}
                                        className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                        style={{ fontSize: "0.72rem", padding: "3px 8px", color: "#f87171" }}
                                    >
                                        ✕ ลบรูปสลิป
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: "10px 0" }}>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--theme-text-muted)" strokeWidth="1.5" style={{ margin: "0 auto 6px auto", display: "block" }}>
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                                <div style={{ fontSize: "0.84rem", color: "#fafafa", fontWeight: 500 }}>
                                    คลิกเพื่ออัปโหลดรูป หรือ ลากไฟล์สลิปมาวางที่นี่
                                </div>
                                <div style={{ fontSize: "0.74rem", color: "var(--theme-text-muted)", marginTop: 3 }}>
                                    หรือกดแปะภาพด้วย <strong style={{ color: "#38bdf8" }}>Ctrl + V</strong> (JPG, PNG, WEBP)
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Manual Form */}
                    <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {/* 1. Select Wallet with Real Config Status */}
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>
                                    วอลเล็ทผู้รับเงินในระบบ *
                                </label>
                                {selectedAccount && (
                                    <span style={{
                                        fontSize: "0.72rem",
                                        fontWeight: 600,
                                        padding: "1px 7px",
                                        borderRadius: 4,
                                        background: isCurrentAccountReady ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                                        color: isCurrentAccountReady ? "#10b981" : "#fbbf24",
                                        border: `1px solid ${isCurrentAccountReady ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                                    }}>
                                        {isCurrentAccountReady ? "พร้อมตรวจสลิป" : "ยังไม่ตั้งค่า Key"}
                                    </span>
                                )}
                            </div>

                            <select
                                className="tenant-select"
                                value={selectedAccountId}
                                onChange={(e) => handleAccountChange(e.target.value)}
                                style={{
                                    ...darkInputStyle,
                                    cursor: "pointer",
                                    borderColor: !isCurrentAccountReady && selectedAccount ? "rgba(245, 158, 11, 0.5)" : "#27272a"
                                }}
                            >
                                {accounts.length === 0 ? (
                                    <option value="">(ไม่พบวอลเล็ทในระบบ กรุณาเพิ่มวอลเล็ทก่อน)</option>
                                ) : (
                                    accounts.map((acc) => {
                                        const ready = hasSlipKeyConfigured(acc);
                                        return (
                                            <option key={acc.id} value={acc.id} style={{ background: "#141417", color: "#fafafa" }}>
                                                {acc.name} ({acc.phoneNumber || "ไม่ระบุเบอร์"}) — {ready ? "⚡ พร้อมตรวจสลิป" : "⚠️ ยังไม่ได้ผูก Key ตรวจสลิป"}
                                            </option>
                                        );
                                    })
                                )}
                            </select>

                            {/* Warning Banner if Account is Missing Slip Verify Token */}
                            {selectedAccount && !isCurrentAccountReady && (
                                <div style={{
                                    marginTop: 8,
                                    padding: "12px 14px",
                                    borderRadius: 8,
                                    background: "rgba(245, 158, 11, 0.08)",
                                    border: "1px solid rgba(245, 158, 11, 0.28)",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 10
                                }}>
                                    <span style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>⚠️</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fbbf24" }}>
                                            วอลเล็ทนี้ยังไม่ได้ผูก Key ตรวจสอบสลิป
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--theme-text-secondary)", marginTop: 3, lineHeight: 1.4 }}>
                                            ระบบจะไม่สามารถตรวจสลิปได้จนกว่าจะนำ Bearer Token จากหน้า <strong>&quot;ตรวจสอบรายการโอนเงินทรูมันนี่&quot;</strong> มากรอกในหน้าจัดการวอลเล็ท
                                        </div>
                                        <div style={{ marginTop: 8 }}>
                                            <Link
                                                href={`/tenant/${prefix}/wallets`}
                                                className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                style={{
                                                    padding: "3px 10px",
                                                    fontSize: "0.74rem",
                                                    background: "rgba(245, 158, 11, 0.16)",
                                                    color: "#fbbf24",
                                                    border: "1px solid rgba(245, 158, 11, 0.35)",
                                                    borderRadius: 6,
                                                    fontWeight: 500,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    textDecoration: "none"
                                                }}
                                            >
                                                ⚙️ ไปที่หน้า จัดการวอลเล็ท เพื่อกรอก Key →
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. Receiver Mobile & Amount */}
                        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 12 }}>
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
                                    style={{ ...darkInputStyle, fontFamily: "monospace" }}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-secondary)", marginBottom: 6 }}>
                                    ยอดเงิน (บาท) *
                                </label>
                                <div style={{ position: "relative" }}>
                                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--theme-text-muted)", fontSize: "0.9rem", fontWeight: 600 }}>
                                        ฿
                                    </span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="tenant-input"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        style={{ ...darkInputStyle, paddingLeft: 28, fontFamily: "monospace", fontWeight: 600, color: "#10b981" }}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Transaction ID */}
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>
                                    เลขที่รายการ TrueMoney (Transaction ID 14 หลัก)
                                </label>
                                <span style={{ fontSize: "0.7rem", color: "var(--theme-text-muted)" }}>
                                    แนะนำเพื่อความแม่นยำ 100%
                                </span>
                            </div>
                            <input
                                type="text"
                                className="tenant-input"
                                placeholder="เช่น 50027287091246"
                                value={transactionId}
                                onChange={(e) => setTransactionId(e.target.value)}
                                style={{ ...darkInputStyle, fontFamily: "monospace", letterSpacing: "0.5px" }}
                            />
                        </div>

                        {/* 4. Date & Sender Mobile */}
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>
                                        วันเวลาทำรายการ (yyyy-mm-dd HH:mm) *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setTransactionDate(getTodayDateTimeLocal())}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            color: "#38bdf8",
                                            fontSize: "0.7rem",
                                            cursor: "pointer",
                                            padding: 0
                                        }}
                                        title="ตั้งเป็นวันเวลาปัจจุบัน"
                                    >
                                        🕒 ปัจจุบัน
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className="tenant-input"
                                    placeholder="2026-11-04 14:30"
                                    value={transactionDate}
                                    onChange={(e) => setTransactionDate(e.target.value)}
                                    style={{ ...darkInputStyle, fontFamily: "monospace" }}
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
                                    style={{ ...darkInputStyle, fontFamily: "monospace" }}
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                            <button
                                type="submit"
                                disabled={verifying || !isCurrentAccountReady}
                                className="tenant-btn"
                                style={{
                                    flex: 1,
                                    height: 42,
                                    fontSize: "0.9rem",
                                    fontWeight: 600,
                                    borderRadius: 8,
                                    cursor: (verifying || !isCurrentAccountReady) ? "not-allowed" : "pointer",
                                    background: !isCurrentAccountReady
                                        ? "rgba(255, 255, 255, 0.05)"
                                        : "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                                    color: !isCurrentAccountReady ? "var(--theme-text-muted)" : "#ffffff",
                                    border: !isCurrentAccountReady ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    boxShadow: isCurrentAccountReady ? "0 4px 14px rgba(16, 185, 129, 0.25)" : "none",
                                    transition: "all 0.15s ease",
                                }}
                            >
                                {verifying ? (
                                    <>
                                        <span className="spinner" style={{ width: 16, height: 16 }}></span>
                                        กำลังตรวจสอบกับ TrueMoney P2P...
                                    </>
                                ) : !isCurrentAccountReady ? (
                                    <>
                                        <span>⚠️</span> กรุณาตั้งค่า Key ตรวจสอบสลิปก่อน
                                    </>
                                ) : (
                                    <>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <circle cx="11" cy="11" r="8" />
                                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                        ตรวจสอบสลิป (TrueMoney P2P)
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                className="tenant-btn tenant-btn-secondary"
                                onClick={handleResetForm}
                                style={{ height: 42, padding: "0 14px", fontSize: "0.82rem", borderRadius: 8 }}
                            >
                                ↺ ล้างฟอร์ม
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Panel: Live Diagnostic Card (Real vs Fake) */}
                <div style={{
                    background: "#141417",
                    border: "1px solid #27272a",
                    borderRadius: 14,
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 460,
                }}>
                    {latestResult ? (
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            height: "100%",
                        }}>
                            {/* Result Header Badge */}
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                padding: "16px 18px",
                                borderRadius: 10,
                                background: latestResult.status === "VALID" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                                border: `1.5px solid ${latestResult.status === "VALID" ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)"}`,
                                marginBottom: 20
                            }}>
                                <div style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 22,
                                    fontWeight: 700,
                                    background: latestResult.status === "VALID" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                    color: latestResult.status === "VALID" ? "#10b981" : "#ef4444",
                                    border: `1.5px solid ${latestResult.status === "VALID" ? "#10b981" : "#ef4444"}`,
                                    flexShrink: 0
                                }}>
                                    {latestResult.status === "VALID" ? "✓" : "✕"}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: "1.15rem",
                                        fontWeight: 700,
                                        color: latestResult.status === "VALID" ? "#34d399" : "#f87171",
                                    }}>
                                        {latestResult.status === "VALID"
                                            ? "สลิปจริง 100% (ผ่านการตรวจสอบ)"
                                            : "สลิปไม่ถูกต้อง / ตรวจพบสลิปปลอม"}
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--theme-text-secondary)", marginTop: 3, lineHeight: 1.4 }}>
                                        {latestResult.message}
                                    </div>
                                </div>
                            </div>

                            {/* Fintech Verified Certificate / Audit Details */}
                            <div style={{
                                background: "rgba(0, 0, 0, 0.3)",
                                borderRadius: 10,
                                padding: "18px 20px",
                                border: "1px solid var(--theme-border-subtle)",
                                marginBottom: 16,
                            }}>
                                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text-muted)", marginBottom: 12, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                                    รายละเอียดธุรกรรมที่ตรวจสอบ:
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: "0.85rem" }}>
                                    <div>
                                        <div style={{ color: "var(--theme-text-muted)", fontSize: "0.75rem" }}>ยอดเงินโอน:</div>
                                        <div style={{ fontFamily: "monospace", fontSize: "1.3rem", fontWeight: 700, color: latestResult.status === "VALID" ? "#34d399" : "#f87171", marginTop: 2 }}>
                                            ฿ {amount ? parseFloat(amount).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "0.00"}
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ color: "var(--theme-text-muted)", fontSize: "0.75rem" }}>สถานะระบบ TrueMoney:</div>
                                        <div style={{
                                            fontWeight: 600,
                                            color: latestResult.status === "VALID" ? "#34d399" : "#f87171",
                                            marginTop: 4,
                                            fontSize: "0.88rem"
                                        }}>
                                            {latestResult.status === "VALID" ? "● พบบันทึกโอนเงินจริง" : "● ไม่พบรายการในระบบ"}
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ color: "var(--theme-text-muted)", fontSize: "0.75rem" }}>วอลเล็ทผู้รับ:</div>
                                        <div style={{ fontFamily: "monospace", fontWeight: 600, color: "#fafafa", marginTop: 2 }}>
                                            {selectedAccount?.name} ({receiverMobile})
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ color: "var(--theme-text-muted)", fontSize: "0.75rem" }}>เบอร์ผู้โอน (ถ้ามี):</div>
                                        <div style={{ fontFamily: "monospace", fontWeight: 500, color: "#fafafa", marginTop: 2 }}>
                                            {senderMobile || "ไม่ระบุ"}
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ color: "var(--theme-text-muted)", fontSize: "0.75rem" }}>เลขที่รายการ TrueMoney:</div>
                                        <div style={{ fontFamily: "monospace", fontWeight: 500, color: "#fafafa", marginTop: 2 }}>
                                            {transactionId || "ไม่ระบุ (ตรวจด้วยยอดและเวลา)"}
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ color: "var(--theme-text-muted)", fontSize: "0.75rem" }}>วันเวลาทำรายการ:</div>
                                        <div style={{ fontFamily: "monospace", fontWeight: 500, color: "#fafafa", marginTop: 2 }}>
                                            {transactionDate}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Attached Slip Preview (if any) */}
                            {slipImageUrl && (
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    background: "rgba(255, 255, 255, 0.02)",
                                    border: "1px solid #27272a",
                                    borderRadius: 8,
                                    padding: "8px 12px",
                                    marginBottom: 16
                                }}>
                                    <img
                                        src={slipImageUrl}
                                        alt="Thumbnail"
                                        style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: "0.8rem", color: "#fafafa", fontWeight: 500 }}>
                                            มีรูปภาพสลิปแนบในประวัติ
                                        </div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--theme-text-muted)" }}>
                                            เก็บเป็นหลักฐานการตรวจสอบเรียบร้อย
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewImage(slipImageUrl)}
                                        className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                        style={{ fontSize: "0.75rem" }}
                                    >
                                        ดูรูปสลิป
                                    </button>
                                </div>
                            )}

                            {/* Footer Certification Note */}
                            <div style={{
                                marginTop: "auto",
                                paddingTop: 12,
                                borderTop: "1px solid #27272a",
                                fontSize: "0.78rem",
                                color: "var(--theme-text-muted)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between"
                            }}>
                                <span>⚡ ส่งตรวจตรง TrueMoney Validate P2P API v1.6</span>
                                <span>เวลาที่ตรวจ: {new Date().toLocaleTimeString("th-TH")}</span>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            textAlign: "center",
                            padding: "40px 20px"
                        }}>
                            <div style={{
                                width: 64,
                                height: 64,
                                borderRadius: "50%",
                                background: "rgba(16, 185, 129, 0.08)",
                                border: "1px solid rgba(16, 185, 129, 0.2)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 28,
                                marginBottom: 16,
                                color: "#10b981"
                            }}>
                                🔍
                            </div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fafafa", marginBottom: 6 }}>
                                พร้อมตรวจสอบสลิปแบบ Real-time
                            </div>
                            <div style={{ fontSize: "0.84rem", color: "var(--theme-text-muted)", maxWidth: 380, lineHeight: 1.5, marginBottom: 20 }}>
                                เมื่อกดปุ่ม &quot;ตรวจสอบสลิป&quot; ระบบจะเชื่อมต่อไปยัง TrueMoney P2P Validate Service v1.6 โดยตรง และแสดงผลลัพธ์ทันที
                            </div>

                            {/* Feature list preview */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 10,
                                width: "100%",
                                maxWidth: 420,
                                textAlign: "left",
                                background: "rgba(255, 255, 255, 0.02)",
                                border: "1px solid #27272a",
                                borderRadius: 10,
                                padding: "14px 16px"
                            }}>
                                <div style={{ fontSize: "0.78rem", color: "var(--theme-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: "#10b981" }}>✓</span> ตรวจสอบเงินเข้าจริง 100%
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--theme-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: "#10b981" }}>✓</span> ดักจับสลิปตัดต่อ/ปลอม
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--theme-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: "#10b981" }}>✓</span> ชี้ชัดจุดที่ไม่ตรงทันที
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--theme-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: "#10b981" }}>✓</span> บันทึกประวัติพร้อมรูปสลิป
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* History Section (Audit Log) */}
            <div style={{
                background: "#141417",
                border: "1px solid #27272a",
                borderRadius: 14,
                padding: "22px 24px",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "#fafafa" }}>
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
                                        background: statusFilter === tab.key ? "#10b981" : "transparent",
                                        color: statusFilter === tab.key ? "#ffffff" : "var(--theme-text-muted)",
                                        border: "none",
                                        cursor: "pointer",
                                        transition: "all 0.15s ease",
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <input
                            type="text"
                            placeholder="ค้นหาเลขรายการ / เบอร์..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            style={{
                                ...darkInputStyle,
                                width: 200,
                                height: 34,
                                fontSize: "0.8rem",
                            }}
                        />
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #27272a", textAlign: "left", color: "var(--theme-text-muted)", fontSize: "0.78rem" }}>
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
                                        <tr key={record.id} style={{ borderBottom: "1px solid #27272a" }}>
                                            <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "0.8rem", color: "var(--theme-text-secondary)" }}>
                                                {new Date(record.verifiedAt).toLocaleString("th-TH")}
                                            </td>
                                            <td style={{ padding: "10px 12px" }}>
                                                <div style={{ fontWeight: 500, color: "#fafafa" }}>
                                                    {record.account?.name || "ไม่ระบุ"}
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--theme-text-muted)", fontFamily: "monospace" }}>
                                                    {record.receiverMobile}
                                                </div>
                                            </td>
                                            <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "0.82rem", color: "#fafafa" }}>
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
                            onClick={() => setPage((p) => p - 1)}
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
                            onClick={() => setPage((p) => p + 1)}
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
                            background: "#18181b",
                            border: "1px solid #27272a",
                            borderRadius: 14,
                            padding: 16,
                            overflow: "hidden",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#fafafa" }}>
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
