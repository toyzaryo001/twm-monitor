"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ToastProvider } from "../../components/Toast";
import "../tenant-theme.css";

import { isTokenExpired } from "../../lib/clientAuth";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const prefix = params.prefix as string;
    const [loading, setLoading] = useState(true);
    const [network, setNetwork] = useState<any>(null);

    useEffect(() => {
        // Allow public pages (Login)
        if (pathname?.includes("/login")) {
            setLoading(false);
            return;
        }

        const token = localStorage.getItem("tenantToken");

        if (!token || isTokenExpired(token)) {
            localStorage.removeItem("tenantToken");
            router.push(`/tenant/${prefix}/login`);
            return;
        }

        // Simple auth check or network info fetch could go here
        // For now, we assume middleware handles protection
        setLoading(false);
    }, [prefix, router, pathname]);

    if (loading) return null;

    // Special layout for Login page (Full screen, no sidebar)
    if (pathname?.includes("/login")) {
        return (
            <ToastProvider>
                <div className="tenant-theme">
                    {children}
                </div>
            </ToastProvider>
        );
    }

    return (
        <ToastProvider>
            <div className="tenant-theme">
                <div className="tenant-layout">
                    <header className="tenant-navbar">
                        <div className="tenant-brand">
                            <span className="tenant-brand-icon">🔶</span>
                            <span className="tenant-brand-text">{prefix.toUpperCase()} Panel</span>
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
                        </div>
                        <div className="tenant-user">
                            <button className="tenant-btn-logout" onClick={() => {
                                localStorage.removeItem("tenantToken");
                                router.push(`/tenant/${prefix}/login`);
                            }}>ออกจากระบบ</button>
                        </div>
                    </header>
                    <main className="tenant-content">
                        {children}
                    </main>
                </div>
            </div>
        </ToastProvider>
    );
}
