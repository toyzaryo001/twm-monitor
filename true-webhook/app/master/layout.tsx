"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ToastProvider } from "../components/Toast";

interface User {
    id: string;
    email: string;
    displayName?: string;
    role: string;
}

const navItems = [
    { href: "/master/dashboard", label: "แดชบอร์ด", icon: "📊" },
    { href: "/master/networks", label: "จัดการเครือข่าย", icon: "🌐" },
    { href: "/master/packages", label: "จัดการแพ็คเกจ", icon: "📦" },
    { href: "/master/payments", label: "ตรวจสอบสลิป", icon: "🧾" },
    { href: "/master/announcements", label: "จัดการประกาศ", icon: "📢" },
    { href: "/master/users", label: "จัดการผู้ใช้", icon: "👥" },
    { href: "/master/bank-settings", label: "บัญชีรับเงิน", icon: "🏦" },
    { href: "/master/settings", label: "ตั้งค่า", icon: "⚙️" },
];

import { isTokenExpired } from "../lib/clientAuth";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");

        if (!token || isTokenExpired(token)) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            router.push("/master/login");
            return;
        }

        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/master/login");
    };

    // Don't show layout on login page
    if (pathname === "/master/login") {
        return <ToastProvider>{children}</ToastProvider>;
    }

    if (loading) {
        return (
            <div className="loading" style={{ minHeight: "100vh", alignItems: "center" }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <ToastProvider>
            <div className="layout">
                <aside className="sidebar">
                    <div className="sidebar-logo">🔐 Master Panel</div>

                    <nav style={{ flex: 1 }}>
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-item ${pathname === item.href ? "active" : ""}`}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                        <div style={{ padding: "0 16px", marginBottom: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{user?.displayName || user?.email}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{user?.role}</div>
                        </div>
                        <button onClick={handleLogout} className="btn btn-secondary" style={{ width: "100%" }}>
                            ออกจากระบบ
                        </button>
                    </div>
                </aside>

                <main className="main-content">{children}</main>
            </div>
        </ToastProvider>
    );
}
