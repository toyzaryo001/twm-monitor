"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import jsQR from "jsqr";
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

interface ComparisonItem {
    label: string;
    slipValue: string;
    realValue: string;
    status: "MATCH" | "MISMATCH";
    detail: string;
}

interface SlipComparison {
    transactionId: ComparisonItem;
    amount: ComparisonItem;
    receiver: ComparisonItem;
    date: ComparisonItem;
    moneyInConfirmed?: boolean;
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

// Smart Slip QR Parser (TrueMoney P2P & PromptPay EMVCo Standard)
function parseSlipQrPayload(raw: string): {
    transactionId?: string;
    receiverMobile?: string;
    amount?: number;
} {
    const result: {
        transactionId?: string;
        receiverMobile?: string;
        amount?: number;
    } = {};

    if (!raw) return result;

    // 1. Check for 14-digit TrueMoney Transaction ID (starting with 500)
    const txMatch = raw.match(/500\d{11}/);
    if (txMatch) {
        result.transactionId = txMatch[0];
    }

    // 2. Check for Thai Mobile Number (06, 08, 09 followed by 8 digits)
    const phoneMatch = raw.match(/0[689]\d{8}/);
    if (phoneMatch) {
        result.receiverMobile = phoneMatch[0];
    }

    // 3. Check for EMVCo TLV Tag 54 (Amount: 54LLAmount)
    const emvAmount = raw.match(/54(\d{2})(\d+(\.\d{2})?)/);
    if (emvAmount) {
        const len = parseInt(emvAmount[1], 10);
        const amtStr = emvAmount[2].slice(0, len);
        const parsed = parseFloat(amtStr);
        if (!isNaN(parsed) && parsed > 0) {
            result.amount = parsed;
        }
    }

    // 4. Check URL Query Parameters if payload is a URL
    try {
        if (raw.startsWith("http://") || raw.startsWith("https://")) {
            const url = new URL(raw);
            const id = url.searchParams.get("transaction_id") || url.searchParams.get("transId") || url.searchParams.get("t") || url.searchParams.get("id");
            if (id && /^\d+$/.test(id)) result.transactionId = id;

            const amt = url.searchParams.get("amount") || url.searchParams.get("amt");
            if (amt) {
                const parsedAmt = parseFloat(amt);
                if (!isNaN(parsedAmt) && parsedAmt > 0) result.amount = parsedAmt;
            }

            const mobile = url.searchParams.get("receiver") || url.searchParams.get("mobile") || url.searchParams.get("to");
            if (mobile && /^0[689]\d{8}$/.test(mobile)) result.receiverMobile = mobile;
        }
    } catch {
        // Not a standard URL, continue
    }

    return result;
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
    const [qrPayload, setQrPayload] = useState<string>("");

    // Smart Scanning State
    const [scanningQr, setScanningQr] = useState(false);
    const [qrDetected, setQrDetected] = useState<boolean>(false);
    const [showManualFields, setShowManualFields] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    // Submission & Result State
    const [verifying, setVerifying] = useState(false);
    const [latestResult, setLatestResult] = useState<{
        status: "VALID" | "INVALID";
        message: string;
        comparison?: SlipComparison;
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

    // Client-side QR Scanner using jsQR and HTML5 Canvas
    const scanQrFromImage = async (file: File): Promise<string | null> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d", { willReadFrequently: true });
                    if (!ctx) return resolve(null);

                    let width = img.width;
                    let height = img.height;
                    const maxDim = 1200;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    const imageData = ctx.getImageData(0, 0, width, height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "attemptBoth",
                    });

                    if (code && code.data) {
                        resolve(code.data);
                    } else {
                        resolve(null);
                    }
                };
                img.onerror = () => resolve(null);
                img.src = e.target?.result as string;
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    };

    // Process file: Upload image + Auto QR Scan & Auto-Fill
    const handleProcessSlipFile = async (file: File) => {
        setUploadingImage(true);
        setScanningQr(true);

        try {
            // 1. Scan QR Code on client-side in parallel
            const scannedQr = await scanQrFromImage(file);

            if (scannedQr) {
                setQrPayload(scannedQr);
                setQrDetected(true);
                const parsed = parseSlipQrPayload(scannedQr);

                if (parsed.transactionId) {
                    setTransactionId(parsed.transactionId);
                }
                if (parsed.amount) {
                    setAmount(parsed.amount.toString());
                }

                // Auto-match receiver wallet from parsed phone number
                if (parsed.receiverMobile && accounts.length > 0) {
                    const cleanPhone = parsed.receiverMobile.replace(/\D/g, "");
                    const matchedAcc = accounts.find((a) => {
                        const accPhone = (a.phoneNumber || "").replace(/\D/g, "");
                        return accPhone === cleanPhone || (cleanPhone.length >= 4 && accPhone.endsWith(cleanPhone));
                    });

                    if (matchedAcc) {
                        setSelectedAccountId(matchedAcc.id);
                        setReceiverMobile(matchedAcc.phoneNumber || cleanPhone);
                    } else {
                        setReceiverMobile(parsed.receiverMobile);
                    }
                }

                showToast({
                    type: "success",
                    title: "✨ สแกน QR สำเร็จ!",
                    message: `ดึงเลขที่รายการ ${parsed.transactionId || ""} ${parsed.amount ? `และยอดเงิน ฿${parsed.amount}` : ""} อัตโนมัติแล้ว`,
                });
            } else {
                setQrDetected(false);
            }

            // 2. Upload file to server for archival
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
                if (!scannedQr) {
                    showToast({
                        type: "info",
                        title: "อัปโหลดรูปสำเร็จ",
                        message: "ไม่พบ QR Code อัตโนมัติ กรุณาระบุยอดเงินหรือเลขที่รายการเพื่อตรวจสอบ",
                    });
                }
            }
        } catch (err: any) {
            showToast({ type: "error", title: "ข้อผิดพลาด", message: "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ" });
        } finally {
            setUploadingImage(false);
            setScanningQr(false);
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
                        handleProcessSlipFile(file);
                        break;
                    }
                }
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [prefix, accounts]);

    // Handle Verify Submit
    const handleVerify = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

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

        // Auto-fallback receiver phone if empty
        const effectiveReceiver = receiverMobile.trim() || (selectedAccount.phoneNumber || "").replace(/\D/g, "");
        if (!effectiveReceiver) {
            showToast({ type: "error", title: "ข้อมูลไม่ครบ", message: "กรุณาระบุเบอร์ผู้รับเงิน" });
            setShowManualFields(true);
            return;
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            showToast({ type: "error", title: "ข้อมูลไม่ครบ", message: "กรุณากรอกยอดเงินในสลิป (เช่น 150.00)" });
            setShowManualFields(true);
            return;
        }

        const effectiveDate = transactionDate.trim() || getTodayDateTimeLocal();

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
                    receiverMobile: effectiveReceiver,
                    amount: numAmount,
                    transactionDate: effectiveDate,
                    transactionId: transactionId.trim() || undefined,
                    senderMobile: senderMobile.trim() || undefined,
                    slipImageUrl: slipImageUrl || undefined,
                    qrPayload: qrPayload || undefined,
                }),
            });

            const data = await res.json();

            if (data.status === "VALID") {
                setLatestResult({
                    status: "VALID",
                    message: data.message || "สลิปจริง 100% (ผ่านการตรวจสอบจาก TrueMoney)",
                    comparison: data.comparison,
                    data: data.data,
                });
                showToast({ type: "success", title: "สลิปจริง 100%!", message: "ข้อมูลตรงกับฐานข้อมูล TrueMoney" });
            } else {
                setLatestResult({
                    status: "INVALID",
                    message: data.message || "ข้อมูลในสลิปไม่ตรงกับฐานข้อมูล TrueMoney (สลิปปลอม)",
                    comparison: data.comparison,
                    data: data.data,
                });
                showToast({ type: "error", title: "สลิปไม่ผ่าน / ปลอมแปลง", message: data.message });
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
        setQrPayload("");
        setQrDetected(false);
        setLatestResult(null);
    };

    const darkInputStyle: React.CSSProperties = {
        width: "100%",
        height: 38,
        background: "#141417",
        border: "1px solid #27272a",
        borderRadius: 8,
        padding: "0 12px",
        color: "#fafafa",
        fontSize: "0.86rem",
        outline: "none",
        transition: "border-color 0.15s ease",
    };

    return (
        <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 60 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h1 className="tenant-page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10, fontSize: "1.45rem" }}>
                            <span>⚡</span> ตรวจสอบสลิปอัจฉริยะ (Smart Slip Verifier)
                        </h1>
                        <span style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 6,
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "#10b981",
                            border: "1px solid rgba(16, 185, 129, 0.28)",
                        }}>
                            TrueMoney P2P Validate v1.6
                        </span>
                    </div>
                    <div style={{ color: "var(--theme-text-muted)", fontSize: "0.85rem", marginTop: 4 }}>
                        เพียงแค่แปะรูปสลิป ระบบจะอ่าน QR Code ดึงข้อมูล และเปรียบเทียบกับข้อมูลจริงจาก TrueMoney ทันที ไม่ต้องพิมพ์เอง
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <Link
                        href={`/tenant/${prefix}/wallets`}
                        className="tenant-btn tenant-btn-secondary"
                        style={{ height: 34, fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                    >
                        ⚙️ จัดการวอลเล็ท
                    </Link>
                    <button
                        className="tenant-btn tenant-btn-secondary"
                        onClick={() => { loadAccounts(); loadStats(); loadHistory(); }}
                        style={{ height: 34, fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                        </svg>
                        รีเฟรช
                    </button>
                </div>
            </div>

            {/* Quick Metrics Ribbon */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "#141417", border: "1px solid #27272a", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>ยอดสลิปจริงวันนี้</span>
                        <span style={{ fontSize: "0.68rem", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>เงินเข้าจริง</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.35rem", fontWeight: 700, color: "#10b981" }}>
                        ฿ {stats.todayValidAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </div>
                </div>

                <div style={{ background: "#141417", border: "1px solid #27272a", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>ตรวจทั้งหมด</span>
                        <span style={{ fontSize: "0.68rem", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Total</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.35rem", fontWeight: 700, color: "#fafafa" }}>
                        {stats.totalCount.toLocaleString()} <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--theme-text-muted)" }}>รายการ</span>
                    </div>
                </div>

                <div style={{ background: "#141417", border: "1px solid #27272a", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>สลิปจริง (ผ่าน 100%)</span>
                        <span style={{ fontSize: "0.68rem", background: "rgba(16, 185, 129, 0.12)", color: "#34d399", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Verified</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.35rem", fontWeight: 700, color: "#34d399" }}>
                        {stats.validCount.toLocaleString()} <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--theme-text-muted)" }}>รายการ</span>
                    </div>
                </div>

                <div style={{ background: "#141417", border: "1px solid #27272a", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>สลิปไม่ผ่าน / ปลอม</span>
                        <span style={{ fontSize: "0.68rem", background: "rgba(239, 68, 68, 0.12)", color: "#f87171", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Alert</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.35rem", fontWeight: 700, color: "#f87171" }}>
                        {stats.invalidCount.toLocaleString()} <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--theme-text-muted)" }}>รายการ</span>
                    </div>
                </div>
            </div>

            {/* Smart Checker Workspace (Left: Smart Drop & Action vs Right: Comparison Matrix) */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 490px) 1fr", gap: 18, marginBottom: 26, alignItems: "start" }}>
                {/* Left Side: Smart Scan Workstation */}
                <div style={{
                    background: "#141417",
                    border: "1px solid #27272a",
                    borderRadius: 14,
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16
                }}>
                    {/* Receiver Wallet Selector */}
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--theme-text-secondary)" }}>
                                วอลเล็ทผู้รับเงินในระบบ *
                            </label>
                            {selectedAccount && (
                                <span style={{
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                    padding: "1px 6px",
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
                            {accounts.map((acc) => {
                                const ready = hasSlipKeyConfigured(acc);
                                return (
                                    <option key={acc.id} value={acc.id} style={{ background: "#141417", color: "#fafafa" }}>
                                        {acc.name} ({acc.phoneNumber || "ไม่ระบุเบอร์"}) — {ready ? "⚡ พร้อมตรวจสลิป" : "⚠️ ยังไม่ผูก Key"}
                                    </option>
                                );
                            })}
                        </select>

                        {selectedAccount && !isCurrentAccountReady && (
                            <div style={{
                                marginTop: 8,
                                padding: "10px 12px",
                                borderRadius: 8,
                                background: "rgba(245, 158, 11, 0.08)",
                                border: "1px solid rgba(245, 158, 11, 0.28)",
                                display: "flex",
                                alignItems: "center",
                                gap: 10
                            }}>
                                <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                                <div style={{ flex: 1, minWidth: 0, fontSize: "0.75rem", color: "#fbbf24", lineHeight: 1.4 }}>
                                    วอลเล็ทนี้ยังไม่ผูก Key สำหรับตรวจสลิป{" "}
                                    <Link href={`/tenant/${prefix}/wallets`} style={{ color: "#38bdf8", textDecoration: "underline", fontWeight: 600 }}>
                                        ไปใส่ Key ที่หน้าจัดการวอลเล็ท
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Big Smart Dropzone */}
                    <div>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragOver(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleProcessSlipFile(file);
                            }}
                            style={{
                                border: isDragOver ? "2px dashed #10b981" : "2px dashed rgba(255, 255, 255, 0.16)",
                                borderRadius: 12,
                                padding: "20px 16px",
                                textAlign: "center",
                                background: isDragOver
                                    ? "rgba(16, 185, 129, 0.08)"
                                    : (slipImageUrl ? "rgba(0, 0, 0, 0.4)" : "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)"),
                                cursor: "pointer",
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
                                    if (file) handleProcessSlipFile(file);
                                }}
                            />

                            {(uploadingImage || scanningQr) ? (
                                <div style={{ padding: "18px 0", color: "var(--theme-text-secondary)", fontSize: "0.85rem" }}>
                                    <span className="spinner" style={{ width: 22, height: 22, margin: "0 auto 10px auto", display: "block" }}></span>
                                    {scanningQr ? "⚡ กำลังสแกน QR Code จากสลิป..." : "กำลังประมวลผลรูปภาพ..."}
                                </div>
                            ) : slipImageUrl ? (
                                <div style={{ position: "relative" }}>
                                    <img
                                        src={slipImageUrl}
                                        alt="สลิปที่อัปโหลด"
                                        style={{ maxHeight: 180, maxWidth: "100%", borderRadius: 8, margin: "0 auto", display: "block", objectFit: "contain" }}
                                    />
                                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewImage(slipImageUrl);
                                            }}
                                            className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                            style={{ fontSize: "0.72rem", padding: "3px 10px" }}
                                        >
                                            🔍 ดูรูปสลิปเต็ม
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleResetForm();
                                            }}
                                            className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                            style={{ fontSize: "0.72rem", padding: "3px 10px", color: "#f87171" }}
                                        >
                                            ✕ ล้างรูป
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: "50%",
                                        background: "rgba(16, 185, 129, 0.1)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        margin: "0 auto 12px auto",
                                        color: "#10b981",
                                        border: "1px solid rgba(16, 185, 129, 0.25)"
                                    }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                            <polyline points="21 15 16 10 5 21" />
                                        </svg>
                                    </div>
                                    <div style={{ fontSize: "0.95rem", color: "#fafafa", fontWeight: 600 }}>
                                        วางรูปสลิปที่นี่ หรือ กด <span style={{ color: "#38bdf8", background: "rgba(56, 189, 248, 0.12)", padding: "1px 6px", borderRadius: 4 }}>Ctrl + V</span>
                                    </div>
                                    <div style={{ fontSize: "0.76rem", color: "var(--theme-text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                                        ระบบจะ <strong style={{ color: "#10b981" }}>อ่าน QR Code อัตโนมัติ</strong> ดึงยอดเงินและเลขรายการทันทีโดยไม่ต้องพิมพ์เอง
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Smart Detected Badge & Extracted Details */}
                    {qrDetected && (
                        <div style={{
                            padding: "12px 14px",
                            borderRadius: 10,
                            background: "rgba(16, 185, 129, 0.08)",
                            border: "1px solid rgba(16, 185, 129, 0.25)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 600, color: "#34d399" }}>
                                <span>✨</span> อ่านข้อมูลจากสลิปสำเร็จ (Auto-detected):
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                                {transactionId && (
                                    <span style={{ fontSize: "0.72rem", background: "rgba(0, 0, 0, 0.4)", padding: "2px 8px", borderRadius: 6, color: "#fafafa", fontFamily: "monospace" }}>
                                        เลขรายการ: <strong>{transactionId}</strong>
                                    </span>
                                )}
                                {amount && (
                                    <span style={{ fontSize: "0.72rem", background: "rgba(0, 0, 0, 0.4)", padding: "2px 8px", borderRadius: 6, color: "#34d399", fontFamily: "monospace" }}>
                                        ยอดเงิน: <strong>฿{parseFloat(amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong>
                                    </span>
                                )}
                                {receiverMobile && (
                                    <span style={{ fontSize: "0.72rem", background: "rgba(0, 0, 0, 0.4)", padding: "2px 8px", borderRadius: 6, color: "#38bdf8", fontFamily: "monospace" }}>
                                        เบอร์ผู้รับ: <strong>{receiverMobile}</strong>
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Primary Action Button: One-Click Check */}
                    <div>
                        <button
                            type="button"
                            onClick={() => handleVerify()}
                            disabled={verifying || !isCurrentAccountReady}
                            className="tenant-btn"
                            style={{
                                width: "100%",
                                height: 44,
                                fontSize: "0.92rem",
                                fontWeight: 600,
                                borderRadius: 10,
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
                                boxShadow: isCurrentAccountReady ? "0 4px 16px rgba(16, 185, 129, 0.3)" : "none",
                                transition: "all 0.15s ease",
                            }}
                        >
                            {verifying ? (
                                <>
                                    <span className="spinner" style={{ width: 16, height: 16 }}></span>
                                    กำลังเปรียบเทียบข้อมูลกับ TrueMoney P2P...
                                </>
                            ) : !isCurrentAccountReady ? (
                                <>
                                    <span>⚠️</span> กรุณาผูก Key ตรวจสลิปก่อน
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    ตรวจสอบสลิป (เทียบของจริงกับ TrueMoney ทันที)
                                </>
                            )}
                        </button>
                    </div>

                    {/* Collapsible Manual Override (Hidden by default to keep page smart & clean) */}
                    <div style={{ borderTop: "1px solid var(--theme-border-subtle)", paddingTop: 10 }}>
                        <button
                            type="button"
                            onClick={() => setShowManualFields(!showManualFields)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--theme-text-muted)",
                                fontSize: "0.78rem",
                                cursor: "pointer",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                            }}
                        >
                            <span>{showManualFields ? "▲" : "▼"}</span>
                            <span>{showManualFields ? "ซ่อนข้อมูลเพิ่มเติม" : "✏️ ปรับแก้ข้อมูลสลิปด้วยตนเอง (กรณีสลิปไม่มี QR หรือไม่ชัด)"}</span>
                        </button>

                        {showManualFields && (
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--theme-text-secondary)", marginBottom: 4 }}>
                                            ยอดเงินในสลิป (บาท) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="150.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            style={darkInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--theme-text-secondary)", marginBottom: 4 }}>
                                            เบอร์ผู้รับ (10 หลัก) *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="08xxxxxxxx"
                                            value={receiverMobile}
                                            onChange={(e) => setReceiverMobile(e.target.value)}
                                            style={darkInputStyle}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--theme-text-secondary)", marginBottom: 4 }}>
                                        เลขที่รายการ TrueMoney (Transaction ID 14 หลัก)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="เช่น 50027287091246"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        style={darkInputStyle}
                                    />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 10 }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--theme-text-secondary)", marginBottom: 4 }}>
                                            วันเวลาในสลิป (yyyy-mm-dd HH:mm)
                                        </label>
                                        <input
                                            type="text"
                                            value={transactionDate}
                                            onChange={(e) => setTransactionDate(e.target.value)}
                                            style={darkInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--theme-text-secondary)", marginBottom: 4 }}>
                                            เบอร์ผู้โอน (ถ้ามี)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="08xxxxxxxx"
                                            value={senderMobile}
                                            onChange={(e) => setSenderMobile(e.target.value)}
                                            style={darkInputStyle}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Real-time Comparison Matrix (เทียบของจริงกับสลิป) */}
                <div style={{
                    background: "#141417",
                    border: "1px solid #27272a",
                    borderRadius: 14,
                    padding: "22px 24px",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 460,
                }}>
                    {latestResult ? (
                        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                            {/* Comparison Master Header Badge */}
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                padding: "16px 18px",
                                borderRadius: 12,
                                background: latestResult.status === "VALID" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                                border: `1.5px solid ${latestResult.status === "VALID" ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)"}`,
                                marginBottom: 18
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
                                            ? "✅ สลิปจริง 100% (ข้อมูลตรงกับ TrueMoney)"
                                            : "❌ ตรวจพบสลิปปลอม / ข้อมูลไม่ตรง"}
                                    </div>
                                    <div style={{ fontSize: "0.84rem", color: "var(--theme-text-secondary)", marginTop: 2 }}>
                                        {latestResult.message}
                                    </div>
                                </div>
                            </div>

                            {/* Side-by-Side Comparison Matrix Table */}
                            <div style={{
                                borderRadius: 10,
                                border: "1px solid var(--theme-border-subtle)",
                                overflow: "hidden",
                                background: "rgba(0, 0, 0, 0.3)",
                                marginBottom: 16
                            }}>
                                <div style={{
                                    padding: "10px 16px",
                                    background: "rgba(255, 255, 255, 0.03)",
                                    borderBottom: "1px solid var(--theme-border-subtle)",
                                    fontSize: "0.82rem",
                                    fontWeight: 700,
                                    color: "#fafafa",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6
                                }}>
                                    <span>📊</span> ตารางเปรียบเทียบ: ข้อมูลบนสลิป VS ข้อมูลจริงจากระบบ TrueMoney
                                </div>

                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                                    <thead>
                                        <tr style={{ background: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid var(--theme-border-subtle)", color: "var(--theme-text-muted)", textAlign: "left" }}>
                                            <th style={{ padding: "10px 14px", width: "25%" }}>หัวข้อตรวจสอบ</th>
                                            <th style={{ padding: "10px 14px", width: "35%" }}>📄 ข้อมูลบนสลิป</th>
                                            <th style={{ padding: "10px 14px", width: "40%" }}>🏦 ข้อมูลจริง TrueMoney</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Row 1: Transaction ID */}
                                        <tr style={{
                                            borderBottom: "1px solid var(--theme-border-subtle)",
                                            background: latestResult.comparison?.transactionId.status === "MISMATCH" ? "rgba(239, 68, 68, 0.08)" : "transparent"
                                        }}>
                                            <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--theme-text-secondary)" }}>
                                                เลขที่รายการ
                                            </td>
                                            <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#fafafa" }}>
                                                {transactionId || "ตรวจตามยอดและเวลา"}
                                            </td>
                                            <td style={{ padding: "10px 14px" }}>
                                                {latestResult.comparison?.transactionId.status === "MATCH" ? (
                                                    <span style={{ color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>✓</span> พบในระบบ TrueMoney
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#f87171", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>✕</span> ไม่พบเลขรายการนี้ (สลิปปลอม)
                                                    </span>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Row 2: Amount */}
                                        <tr style={{
                                            borderBottom: "1px solid var(--theme-border-subtle)",
                                            background: latestResult.comparison?.amount.status === "MISMATCH" ? "rgba(239, 68, 68, 0.08)" : "transparent"
                                        }}>
                                            <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--theme-text-secondary)" }}>
                                                ยอดเงินโอน
                                            </td>
                                            <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: "0.95rem", fontWeight: 700, color: latestResult.status === "VALID" ? "#34d399" : "#f87171" }}>
                                                ฿ {amount ? parseFloat(amount).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "0.00"}
                                            </td>
                                            <td style={{ padding: "10px 14px" }}>
                                                {latestResult.comparison?.amount.status === "MATCH" ? (
                                                    <span style={{ color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>✓</span> ยอดเงินตรงกับรายการจริง 100%
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#f87171", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>✕</span> ยอดเงินไม่ตรง (ตรวจพบการตัดต่อตัวเลข!)
                                                    </span>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Row 3: Receiver Wallet */}
                                        <tr style={{
                                            borderBottom: "1px solid var(--theme-border-subtle)",
                                            background: latestResult.comparison?.receiver.status === "MISMATCH" ? "rgba(239, 68, 68, 0.08)" : "transparent"
                                        }}>
                                            <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--theme-text-secondary)" }}>
                                                บัญชีผู้รับเงิน
                                            </td>
                                            <td style={{ padding: "10px 14px", color: "#fafafa" }}>
                                                {selectedAccount?.name} ({receiverMobile})
                                            </td>
                                            <td style={{ padding: "10px 14px" }}>
                                                {latestResult.comparison?.receiver.status === "MATCH" ? (
                                                    <span style={{ color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>✓</span> โอนเข้าบัญชีนี้ถูกต้อง
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#f87171", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>✕</span> โอนเข้าบัญชีอื่น ไม่ใช่บัญชีนี้
                                                    </span>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Row 4: Transaction Date */}
                                        <tr style={{
                                            borderBottom: "1px solid var(--theme-border-subtle)",
                                            background: latestResult.comparison?.date.status === "MISMATCH" ? "rgba(239, 68, 68, 0.08)" : "transparent"
                                        }}>
                                            <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--theme-text-secondary)" }}>
                                                วันเวลาทำรายการ
                                            </td>
                                            <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#fafafa" }}>
                                                {transactionDate}
                                            </td>
                                            <td style={{ padding: "10px 14px" }}>
                                                {latestResult.comparison?.date.status === "MATCH" ? (
                                                    <span style={{ color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>✓</span> ตรงกับเวลาทำรายการจริง
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#f87171", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>✕</span> เวลาในสลิปถูกดัดแปลง
                                                    </span>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Row 5: Financial Webhook Status */}
                                        <tr>
                                            <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--theme-text-secondary)" }}>
                                                สถานะเงินเข้าบัญชี
                                            </td>
                                            <td style={{ padding: "10px 14px", color: "var(--theme-text-muted)" }}>
                                                ตามหลักฐานสลิป
                                            </td>
                                            <td style={{ padding: "10px 14px" }}>
                                                {latestResult.status === "VALID" ? (
                                                    <span style={{ color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>🛡️</span> ยืนยันเงินเข้าจริง 100% (ชัวร์ ปลอดภัย)
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#f87171", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>🚨</span> ไม่มียอดเงินเข้าบัญชีจริง (ห้ามทำรายการ)
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Attached Slip Thumbnail */}
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
                                            รูปภาพสลิปที่ใช้ตรวจสอบ
                                        </div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--theme-text-muted)" }}>
                                            {qrDetected ? "อ่านค่าผ่าน QR Code อัตโนมัติ" : "อัปโหลดภาพเรียบร้อย"}
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

                            {/* Footer Certification */}
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
                                width: 68,
                                height: 68,
                                borderRadius: "50%",
                                background: "rgba(16, 185, 129, 0.08)",
                                border: "1px solid rgba(16, 185, 129, 0.2)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 30,
                                marginBottom: 16,
                                color: "#10b981"
                            }}>
                                📊
                            </div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fafafa", marginBottom: 6 }}>
                                พร้อมเปรียบเทียบข้อมูลจริงกับสลิป
                            </div>
                            <div style={{ fontSize: "0.84rem", color: "var(--theme-text-muted)", maxWidth: 390, lineHeight: 1.5, marginBottom: 20 }}>
                                เพียงวางภาพสลิปด้านซ้ายแล้วกดปุ่มตรวจสอบ ระบบจะแสดงตารางเปรียบเทียบชี้ชัดทีละรายการ (เลขที่รายการ / ยอดเงิน / ผู้รับ / วันเวลา) ทันที
                            </div>

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
                                    <span style={{ color: "#10b981" }}>✓</span> สแกน QR อัตโนมัติใน 0.1 วิ
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--theme-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: "#10b981" }}>✓</span> จับพิรุธสลิปตัดต่อยอดเงิน
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--theme-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: "#10b981" }}>✓</span> ชี้ชัดจุดที่ไม่ตรงในตาราง
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--theme-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: "#10b981" }}>✓</span> ป้องกันสลิปเวียนสลิปซ้ำ
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
                padding: "20px 24px",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "#fafafa" }}>
                            📜 ประวัติการตรวจสอบสลิปย้อนหลัง
                        </div>
                        <div style={{ color: "var(--theme-text-muted)", fontSize: "0.82rem", marginTop: 2 }}>
                            บันทึกผลการตรวจสอบสลิปทุกรายการ พร้อมรูปภาพหลักฐานและผลวินิจฉัย
                        </div>
                    </div>

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
                                width: 190,
                                height: 32,
                                fontSize: "0.78rem",
                            }}
                        />
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #27272a", textAlign: "left", color: "var(--theme-text-muted)", fontSize: "0.76rem" }}>
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
                                    <td colSpan={7} style={{ padding: "26px 0", textAlign: "center", color: "var(--theme-text-muted)" }}>
                                        <span className="spinner" style={{ width: 18, height: 18, margin: "0 auto 8px auto", display: "block" }}></span>
                                        กำลังโหลดประวัติ...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: "26px 0", textAlign: "center", color: "var(--theme-text-muted)" }}>
                                        ยังไม่มีประวัติการตรวจสอบสลิป
                                    </td>
                                </tr>
                            ) : (
                                history.map((record) => {
                                    const isOk = record.status === "VALID";

                                    return (
                                        <tr key={record.id} style={{ borderBottom: "1px solid #27272a" }}>
                                            <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "0.78rem", color: "var(--theme-text-secondary)" }}>
                                                {new Date(record.verifiedAt).toLocaleString("th-TH")}
                                            </td>
                                            <td style={{ padding: "10px 12px" }}>
                                                <div style={{ fontWeight: 500, color: "#fafafa" }}>
                                                    {record.account?.name || "ไม่ระบุ"}
                                                </div>
                                                <div style={{ fontSize: "0.74rem", color: "var(--theme-text-muted)", fontFamily: "monospace" }}>
                                                    {record.receiverMobile}
                                                </div>
                                            </td>
                                            <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "0.8rem", color: "#fafafa" }}>
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
                                            <td style={{ padding: "10px 12px", color: "var(--theme-text-secondary)", fontSize: "0.78rem", maxWidth: 300 }}>
                                                {record.resultMessage || "-"}
                                            </td>
                                            <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                {record.slipImageUrl ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewImage(record.slipImageUrl!)}
                                                        className="tenant-btn tenant-btn-secondary tenant-btn-sm"
                                                        style={{ padding: "2px 8px", fontSize: "0.74rem", height: 26 }}
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
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 14 }}>
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

            {/* Slip Image Fullscreen Modal */}
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
