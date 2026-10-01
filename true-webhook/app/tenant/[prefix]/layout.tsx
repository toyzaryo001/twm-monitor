"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ToastProvider } from "../../components/Toast";
import "../tenant-theme.css";
import { isTokenExpired } from "../../lib/clientAuth";
import AnnouncementDisplay from "./components/AnnouncementDisplay";

interface TenantUser {
    id: string;
    email: string;
    displayName?: string;
    role: string;
}

interface NetworkInfo {
    id: string;
    name: string;
    prefix: string;
    logoUrl?: string | null;
    isActive: boolean;
    expiredAt?: string | null;
    currentPackage?: string | null;
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const prefix = params.prefix as string;

    const [loading, setLoading] = useState(true);
    const [network, setNetwork] = useState<NetworkInfo | null>(null);
    const [user, setUser] = useState<TenantUser | null>(null);
    const [theme, setTheme] = useState<"dark" | "light">("dark");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Live Thai Timezone Clock State
    const [clockTime, setClockTime] = useState("");
    const [clockDate, setClockDate] = useState("");

    // Initialize Theme from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem("twm_theme") as "dark" | "light" | null;
        if (savedTheme === "light" || savedTheme === "dark") {
            setTheme(savedTheme);
        } else if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
            setTheme("light");
        }
    }, []);

    const toggleTheme = () => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        localStorage.setItem("twm_theme", next);
    };

    // Live Thai Timezone Clock (Asia/Bangkok • GMT+7)
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString("th-TH", {
                timeZone: "Asia/Bangkok",
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
            const dateStr = now.toLocaleDateString("th-TH", {
                timeZone: "Asia/Bangkok",
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
            });
            setClockTime(timeStr);
            setClockDate(dateStr);
        };

        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    // Listen for custom event when profile/logo is updated from settings
    useEffect(() => {
        const handleProfileUpdated = (event: Event) => {
            const customEvent = event as CustomEvent<{ name?: string; logoUrl?: string | null }>;
            if (customEvent.detail) {
                setNetwork(prev => prev ? ({
                    ...prev,
                    name: customEvent.detail.name || prev.name,
                    logoUrl: customEvent.detail.logoUrl !== undefined ? customEvent.detail.logoUrl : prev.logoUrl,
                }) : prev);
            }
        };

        window.addEventListener("tenant-profile-updated", handleProfileUpdated);
        return () => window.removeEventListener("tenant-profile-updated", handleProfileUpdated);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        const isPackagesPage = pathname?.includes("/packages");

        // Allow public pages (Login, Expired)
        if (pathname?.includes("/login") || pathname?.includes("/expired")) {
            setLoading(false);
            return;
        }

        const token = localStorage.getItem("tenantToken");
        if (!token || isTokenExpired(token)) {
            localStorage.removeItem("tenantToken");
            router.push(`/tenant/${prefix}/login`);
            return;
        }

        // Load stored user
        const storedUser = localStorage.getItem("tenantUser");
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch {
                localStorage.removeItem("tenantUser");
            }
        }

        // Fetch network status to check expiration
        fetch(`/api/tenant/${prefix}/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.ok) {
                    setNetwork(data.data.network);
                    if (data.data.network.expiredAt && !isPackagesPage) {
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

    const handleLogout = () => {
        localStorage.removeItem("tenantToken");
        localStorage.removeItem("tenantUser");
        router.push(`/tenant/${prefix}/login`);
    };

    if (loading) return null;

    // Special layout for Login / Expired page
    if (pathname?.includes("/login") || pathname?.includes("/expired")) {
        return (
            <ToastProvider>
                <div className="tenant-theme" data-theme={theme}>
                    {children}
                </div>
            </ToastProvider>
        );
    }

    const networkDisplayName = network?.name || prefix.toUpperCase();
    const initials = networkDisplayName.trim().slice(0, 2).toUpperCase() || "TW";
    const userDisplayName = user?.displayName || user?.email || "ผู้ดูแลระบบ";
    const userInitials = userDisplayName.trim().slice(0, 2).toUpperCase() || "AD";

    const navLinks = [
        {
            href: `/tenant/${prefix}/dashboard`,
            label: "ภาพรวม",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="9" />
                    <rect x="14" y="3" width="7" height="5" />
                    <rect x="14" y="12" width="7" height="9" />
                    <rect x="3" y="16" width="7" height="5" />
                </svg>
            )
        },
        {
            href: `/tenant/${prefix}/wallets`,
            label: "บัญชีวอลเล็ท",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
            )
        },
        {
            href: `/tenant/${prefix}/history`,
            label: "ประวัติรายการ",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
            )
        },
        {
            href: `/tenant/${prefix}/settings`,
            label: "ตั้งค่าระบบ",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            )
        },
        {
            href: `/tenant/${prefix}/packages`,
            label: "แพ็กเกจ",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
            )
        },
        {
            href: `/tenant/${prefix}/contact`,
            label: "ติดต่อสอบถาม",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
            )
        },
    ];

    return (
        <ToastProvider>
            <div className="tenant-theme" data-theme={theme}>
                <div className="tenant-shell">
                    {/* Mobile Backdrop */}
                    {mobileMenuOpen && (
                        <div className="tenant-sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />
                    )}

                    {/* ---------- LEFT SIDEBAR ---------- */}
                    <aside className={`tenant-sidebar ${mobileMenuOpen ? "open" : ""}`}>
                        {/* Tenant Brand / Logo Header */}
                        <div className="tenant-sidebar-brand">
                            {network?.logoUrl ? (
                                <img
                                    src={network.logoUrl}
                                    alt={networkDisplayName}
                                    className="tenant-logo-img"
                                />
                            ) : (
                                <div className="tenant-logo-placeholder">
                                    {initials}
                                </div>
                            )}
                            <div className="tenant-brand-info">
                                <span className="tenant-brand-name" title={networkDisplayName}>
                                    {networkDisplayName}
                                </span>
                                <span className="tenant-brand-badge">
                                    {network?.currentPackage ? network.currentPackage.toUpperCase() : "MONITOR"}
                                </span>
                            </div>
                        </div>

                        {/* Navigation Links */}
                        <nav className="tenant-sidebar-nav">
                            <div className="tenant-nav-section-title">เมนูหลัก</div>
                            {navLinks.map((item) => {
                                const isActive = pathname?.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`tenant-nav-item ${isActive ? "active" : ""}`}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Sidebar Footer */}
                        <div className="tenant-sidebar-footer">
                            <div className="tenant-network-status">
                                <span className={`status-dot ${network?.isActive ? "online" : ""}`} />
                                <span>{network?.isActive ? "ระบบทำงานปกติ" : "ปิดใช้งานชั่วคราว"}</span>
                            </div>
                            {network?.expiredAt && (
                                <div className="tenant-expiry-info">
                                    หมดอายุ: {new Date(network.expiredAt).toLocaleDateString("th-TH")}
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* ---------- MAIN CONTAINER ---------- */}
                    <div className="tenant-main-container">
                        {/* ---------- TOPBAR ---------- */}
                        <header className="tenant-topbar">
                            <div className="tenant-topbar-left">
                                <button
                                    type="button"
                                    className="tenant-menu-toggle"
                                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                    aria-label="Toggle Navigation Menu"
                                >
                                    ☰
                                </button>

                                {/* Live Thai Timezone Clock */}
                                <div className="tenant-live-clock" title="เวลามาตรฐานประเทศไทย (Asia/Bangkok • GMT+7)">
                                    <div className="clock-icon-wrap">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                    </div>
                                    <div className="clock-info">
                                        <div className="clock-time">{clockTime || "--:--:--"}</div>
                                        <div className="clock-date">{clockDate} • ICT (UTC+7)</div>
                                    </div>
                                </div>
                            </div>

                            <div className="tenant-topbar-right">
                                {/* Theme Mode Switcher */}
                                <button
                                    type="button"
                                    className="tenant-theme-toggle"
                                    onClick={toggleTheme}
                                    title={theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง (Light Mode)" : "เปลี่ยนเป็นโหมดมืด (Dark Mode)"}
                                >
                                    {theme === "dark" ? (
                                        <>
                                            <span style={{ fontSize: 14 }}>☀️</span>
                                            <span>สว่าง</span>
                                        </>
                                    ) : (
                                        <>
                                            <span style={{ fontSize: 14 }}>🌙</span>
                                            <span>มืด</span>
                                        </>
                                    )}
                                </button>

                                {/* User Card */}
                                <div className="tenant-user-card">
                                    <div className="tenant-user-avatar">
                                        {userInitials}
                                    </div>
                                    <div className="tenant-user-meta">
                                        <span className="tenant-user-name" title={userDisplayName}>
                                            {userDisplayName}
                                        </span>
                                        <span className="tenant-user-role">
                                            {user?.role === "MASTER" ? "Master Admin" : "ผู้ดูแลเครือข่าย"}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className="tenant-btn-logout-compact"
                                        onClick={handleLogout}
                                        title="ออกจากระบบ"
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                            <polyline points="16 17 21 12 16 7" />
                                            <line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </header>

                        {/* Page Content */}
                        <main className="tenant-main-content">
                            <AnnouncementDisplay prefix={prefix} />
                            {children}
                        </main>
                    </div>
                </div>
            </div>
        </ToastProvider>
    );
}
