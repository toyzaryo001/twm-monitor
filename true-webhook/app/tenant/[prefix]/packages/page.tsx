"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ToastProvider, useToast } from "../../../components/Toast";

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
    package: {
        name: string;
        durationDays: number;
    };
}

function PackagesContent() {
    const params = useParams();
    const prefix = params.prefix as string;

    const [packages, setPackages] = useState<Package[]>([]);
    const [pendingRequest, setPendingRequest] = useState<PaymentRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
    const [uploading, setUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    useEffect(() => {
        fetchData();
    }, [prefix]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem("tenantToken");
            const headers = { Authorization: `Bearer ${token}` };

            const [pkgRes, histRes] = await Promise.all([
                fetch(`/api/tenant/${prefix}/packages`, { headers }),
                fetch(`/api/tenant/${prefix}/payments/history`, { headers })
            ]);

            const pkgData = await pkgRes.json();
            const histData = await histRes.json();

            if (pkgData.ok) setPackages(pkgData.data);

            if (histData.ok && histData.data.length > 0) {
                // Check if the latest one is pending
                const latest = histData.data[0];
                if (latest.status === "PENDING") {
                    setPendingRequest(latest);
                }
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
                fetchData(); // Refresh to show pending state
            } else {
                showToast({ title: result.error || "อัปโหลดล้มเหลว", type: "error" });
            }
        } catch (err) {
            showToast({ title: "Upload failed", type: "error" });
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

    if (pendingRequest) {
        return (
            <div className="p-4 md:p-8 flex items-center justify-center min-h-[60vh]">
                <div className="bg-[#1e1e1e] border border-yellow-500/30 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="text-5xl mb-4">⏳</div>
                    <h2 className="text-2xl font-bold text-white mb-2">รอตรวจสอบยอดเงิน</h2>
                    <p className="text-gray-400 mb-6">
                        คุณได้ส่งหลักฐานการโอนเงินสำหรับแพ็คเกจ <br />
                        <span className="text-indigo-400 font-bold">{pendingRequest.package.name}</span> เรียบร้อยแล้ว
                    </p>
                    <div className="bg-[#111] rounded-lg p-4 text-sm text-gray-500">
                        แจ้งเมื่อ: {new Date(pendingRequest.createdAt).toLocaleString("th-TH")}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-2xl font-bold text-white mb-2">เลือกแพ็คเกจต่ออายุ</h1>
            <p className="text-gray-400 mb-8">เลือกแผนที่เหมาะสมกับการใช้งานของคุณ</p>

            {selectedPkg ? (
                // Upload Step
                <div className="max-w-2xl mx-auto bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 md:p-8">
                    <button
                        onClick={() => setSelectedPkg(null)}
                        className="mb-6 text-gray-400 hover:text-white flex items-center gap-2"
                    >
                        ← ย้อนกลับ
                    </button>

                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-white mb-4">โอนเงินชำระค่าบริการ</h2>

                            <div className="bg-[#252525] p-4 rounded-xl mb-6">
                                <div className="text-gray-400 text-sm mb-1">ธนาคาร</div>
                                <div className="text-white font-medium flex items-center gap-2">
                                    <span className="w-6 h-6 bg-green-500 rounded-full inline-block"></span>
                                    กสิกรไทย (K-Bank)
                                </div>
                                <div className="my-3 border-t border-[#333]"></div>
                                <div className="text-gray-400 text-sm mb-1">เลขบัญชี</div>
                                <div className="text-2xl font-mono text-indigo-400 font-bold">xxx-x-xxxxx-x</div>
                                <div className="text-gray-400 text-sm mt-1">ชื่อบัญชี: บจก. ทรู เว็บฮุก</div>
                            </div>

                            <div className="text-gray-400 text-sm">
                                * กรุณาโอนเงินยอด <strong className="text-white">฿{selectedPkg.price.toLocaleString()}</strong> <br />
                                แล้วแนบสลิปหลักฐานด้านขวา
                            </div>
                        </div>

                        <div className="flex-1 border-l border-[#333] pl-0 md:pl-8 pt-8 md:pt-0 border-t md:border-t-0">
                            <h3 className="text-lg font-bold text-white mb-4">แนบสลิปโอนเงิน</h3>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    border-2 border-dashed border-[#444] hover:border-indigo-500 rounded-xl 
                                    aspect-[3/4] flex flex-col items-center justify-center cursor-pointer
                                    bg-[#111] transition-colors
                                    ${uploading ? "opacity-50 pointer-events-none" : ""}
                                `}
                            >
                                <div className="text-4xl mb-2">📤</div>
                                <span className="text-gray-400 text-sm">คลิกเพื่อเลือกไฟล์</span>
                                <span className="text-gray-600 text-xs mt-1">Support: JPG, PNG</span>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleUpload}
                            />

                            {uploading && <div className="text-center text-indigo-400 mt-4 text-sm">กำลังอัปโหลด...</div>}
                        </div>
                    </div>
                </div>
            ) : (
                // Package Selection Step
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {packages.map(pkg => (
                        <div key={pkg.id} className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-6 hover:border-indigo-500 transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.1)] flex flex-col">
                            <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-4xl font-bold text-indigo-400">฿{pkg.price.toLocaleString()}</span>
                                <span className="text-gray-500">/ {pkg.durationDays} วัน</span>
                            </div>

                            <div className="flex-1 mb-8">
                                <ul className="space-y-3">
                                    {pkg.description?.split("\n").map((line, i) => (
                                        <li key={i} className="flex items-start gap-3 text-gray-300 text-sm">
                                            <span className="text-green-500 mt-0.5">✓</span>
                                            {line}
                                        </li>
                                    ))}
                                    {!pkg.description && (
                                        <li className="text-gray-500 text-sm italic">ไม่มีรายละเอียด</li>
                                    )}
                                </ul>
                            </div>

                            <button
                                onClick={() => setSelectedPkg(pkg)}
                                className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                เลือกแพ็คเกจนี้
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TenantPackagesPage() {
    return (
        <ToastProvider>
            <PackagesContent />
        </ToastProvider>
    );
}
