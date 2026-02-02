"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ToastProvider } from "../../components/Toast";
import "../tenant-theme.css";

import { isTokenExpired } from "../../lib/clientAuth";

import AnnouncementDisplay from "./components/AnnouncementDisplay";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    // ... (existing code)

    const router = useRouter();
    const pathname = usePathname();
    const prefix = params.prefix as string;
    const [loading, setLoading] = useState(true);
    const [network, setNetwork] = useState<any>(null);



    useEffect(() => {
        // Allow public pages (Login, Expired, Packages for renewal)
        if (pathname?.includes("/login") || pathname?.includes("/expired") || pathname?.includes("/packages")) {
            setLoading(false);
            return;
        }

        const token = localStorage.getItem("tenantToken");

        if (!token || isTokenExpired(token)) {
            localStorage.removeItem("tenantToken");
            router.push(`/tenant/${prefix}/login`);
            return;
        }

        // Fetch network status to check expiration
        fetch(`/api/tenant/${prefix}/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.ok) {
                    setNetwork(data.data.network);
                    if (data.data.network.expiredAt) {
                        const expiredAt = new Date(data.data.network.expiredAt);
                        if (new Date() > expiredAt) {
                            router.push(`/tenant/${prefix}/expired`);
                            return;
                        }
                    }
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));

    }, [prefix, router, pathname]);

    if (loading) return null;

    // Special layout for Login/Expired page (Full screen, no sidebar)
    if (pathname?.includes("/login") || pathname?.includes("/expired")) {
        return (
            <ToastProvider>
                <div className="tenant-theme">
                    {children}
                </div>
            </ToastProvider>
        );
    }

    // Minimal layout for Packages page (when renewing after expiry)
    if (pathname?.includes("/packages")) {
        return (
            <ToastProvider>
                <div className="tenant-theme">
                    <div style={{ padding: "20px", maxWidth: 1200, margin: "0 auto" }}>
                        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
                            <span style={{ fontSize: 24 }}>🔶</span>
                            <span style={{ fontSize: 20, fontWeight: 700 }}>{prefix.toUpperCase()} - ต่ออายุบริการ</span>
                        </div>
                        {children}
                    </div>
                </div>
            </ToastProvider>
        );
    }

    return (
        <ToastProvider>
            <div className="tenant-theme">
                <div className="tenant-layout">
                    <header className="tenant-navbar">
                        <div className="tenant-brand" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span className="tenant-brand-icon">🔶</span>
                            <span className="tenant-brand-text">{prefix.toUpperCase()} Panel</span>
                            {network?.currentPackage && (
                                <span style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: 0.5,
                                    background: network.currentPackage.toUpperCase().includes("PRO")
                                        ? "linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #c084fc 100%)"
                                        : "linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #93c5fd 100%)",
                                    color: "#ffffff",
                                    padding: "5px 14px",
                                    borderRadius: 6,
                                    textTransform: "uppercase",
                                    boxShadow: network.currentPackage.toUpperCase().includes("PRO")
                                        ? "0 4px 15px rgba(139, 92, 246, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)"
                                        : "0 4px 15px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
                                    border: "1px solid rgba(255,255,255,0.2)",
                                    textShadow: "0 1px 2px rgba(0,0,0,0.3)"
                                }}>
                                    {network.currentPackage.toUpperCase().includes("PRO") ? "👑" : "💎"} {network.currentPackage}
                                </span>
                            )}
                        </div>
                        <div className="tenant-menu">
                            <Link href={`/tenant/${prefix}/dashboard`} className={`tenant-menu-item ${pathname?.includes("/dashboard") ? "active" : ""}`}>
                                📊 ภาพรวม
                            </Link>
                            <Link href={`/tenant/${prefix}/wallets`} className={`tenant-menu-item ${pathname?.includes("/wallets") ? "active" : ""}`}>
                                💳 วอลเล็ท
                            </Link>
                            <Link href={`/tenant/${prefix}/history`} className={`tenant-menu-item ${pathname?.includes("/history") ? "active" : ""}`}>
                                📜 ประวัติ
                            </Link>
                            <Link href={`/tenant/${prefix}/settings`} className={`tenant-menu-item ${pathname?.includes("/settings") ? "active" : ""}`}>
                                ⚙️ ตั้งค่า
                            </Link>
                            <Link href={`/tenant/${prefix}/packages`} className={`tenant-menu-item ${pathname?.includes("/packages") ? "active" : ""}`}>
                                📦 แพ็คเกจ
                            </Link>
                        </div>
                        <div className="tenant-user">
                            <button className="tenant-btn-logout" onClick={() => {
                                localStorage.removeItem("tenantToken");
                                router.push(`/tenant/${prefix}/login`);
                            }}>ออกจากระบบ</button>
                        </div>
                    </header>
                    <main className="tenant-content">
                        <AnnouncementDisplay prefix={prefix} />
                        {children}
                    </main>
                </div>
            </div>
        </ToastProvider>
    );
}
