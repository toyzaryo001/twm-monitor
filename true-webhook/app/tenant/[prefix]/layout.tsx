"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import Link from "next/link";

interface User {
    id: string;
    email: string;
    displayName?: string;
    role: string;
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
        { href: `/tenant/${prefix}/accounts`, label: "จัดการบัญชี", icon: "💳" },
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

        if (storedUser) setUser(JSON.parse(storedUser));

        // Fetch network info
        fetch(`/api/tenant/${prefix}/stats`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.ok) setNetworkName(data.data.network.name);
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
        return <>{children}</>;
    }

    if (loading) {
        return <div className="loading" style={{ minHeight: "100vh", alignItems: "center" }}><div className="spinner" /></div>;
    }

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-logo">🏪 {networkName || prefix}</div>

                <nav style={{ flex: 1 }}>
                    {navItems.map((item) => (
                        <Link key={item.href} href={item.href} className={`nav-item ${pathname === item.href ? "active" : ""}`}>
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
                    {user?.role === "MASTER" && (
                        <Link href="/master/dashboard" className="btn btn-secondary" style={{ width: "100%", marginBottom: 8 }}>
                            ← กลับ Master
                        </Link>
                    )}
                    <button onClick={handleLogout} className="btn btn-secondary" style={{ width: "100%" }}>
                        ออกจากระบบ
                    </button>
                </div>
            </aside>

            <main className="main-content">{children}</main>
        </div>
    );
}
