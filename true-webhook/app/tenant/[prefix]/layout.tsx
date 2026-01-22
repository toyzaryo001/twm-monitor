"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import Link from "next/link";
import "../tenant-theme.css";

interface User {
    id: string;
    email: string;
    displayName?: string;
    role: string;
    network?: { id: string; name: string; prefix: string };
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();
    const prefix = params.prefix as string;

    const [user, setUser] = useState<User | null>(null);
    const [networkName, setNetworkName] = useState("");
    const [loading, setLoading] = useState(true);

    const navItems = [
        { href: `/tenant/${prefix}/dashboard`, label: "แดชบอร์ด", icon: "📊" },
        { href: `/tenant/${prefix}/wallets`, label: "วอลเล็ท", icon: "💳" },
        { href: `/tenant/${prefix}/history`, label: "ประวัติ", icon: "📜" },
        { href: `/tenant/${prefix}/settings`, label: "ตั้งค่า", icon: "⚙️" },
    ];

    useEffect(() => {
        // Skip auth check on login page
        if (pathname?.endsWith("/login")) {
            setLoading(false);
            return;
        }

        const token = localStorage.getItem("tenantToken");
        const storedUser = localStorage.getItem("tenantUser");

        if (!token) {
            router.push(`/tenant/${prefix}/login`);
            return;
        }

        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            if (parsedUser.network) {
                setNetworkName(parsedUser.network.name);
            }
        }

        // Fetch network info
        fetch(`/api/tenant/${prefix}/auth/status`)
            .then((r) => r.json())
            .then((data) => {
                if (data.ok && data.data.name) {
                    setNetworkName(data.data.name);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [router, prefix, pathname]);

    const handleLogout = () => {
        localStorage.removeItem("tenantToken");
        localStorage.removeItem("tenantUser");
        router.push(`/tenant/${prefix}/login`);
    };

    // Don't wrap login page with layout
    if (pathname?.endsWith("/login")) {
        return <div className="tenant-theme">{children}</div>;
    }

    if (loading) {
        return (
            <div className="tenant-theme">
                <div className="loading" style={{ minHeight: "100vh", alignItems: "center" }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    const getUserInitials = () => {
        if (user?.displayName) {
            return user.displayName.substring(0, 2).toUpperCase();
        }
        if (user?.email) {
            return user.email.substring(0, 2).toUpperCase();
        }
        return "U";
    };

    return (
        <div className="tenant-theme">
            <div className="tenant-layout">
                {/* Top Navbar */}
                <nav className="tenant-navbar">
                    <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
                        {/* Brand */}
                        <div className="tenant-navbar-brand">
                            <div className="brand-icon">💰</div>
                            <span>{networkName || prefix}</span>
                        </div>

                        {/* Navigation */}
                        <div className="tenant-nav">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`tenant-nav-item ${pathname === item.href ? "active" : ""}`}
                                >
                                    <span>{item.icon}</span>
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="tenant-navbar-right">
                        {user?.role === "MASTER" && (
                            <Link href="/master/dashboard" className="tenant-btn tenant-btn-secondary" style={{ fontSize: 13 }}>
                                ← Master Panel
                            </Link>
                        )}

                        <div className="tenant-user-info">
                            <div className="tenant-user-avatar">{getUserInitials()}</div>
                            <div>
                                <div className="tenant-user-name">{user?.displayName || user?.email}</div>
                                <div className="tenant-user-role">
                                    {user?.role === "MASTER" ? "Master" : "Super Admin"}
                                </div>
                            </div>
                        </div>

                        <button onClick={handleLogout} className="tenant-btn tenant-btn-secondary tenant-btn-icon" title="ออกจากระบบ">
                            🚪
                        </button>
                    </div>
                </nav>

                {/* Main Content */}
                <main className="tenant-main">{children}</main>
            </div>
        </div>
    );
}
