"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ToastProvider } from "../components/Toast";
import { isTokenExpired } from "../lib/clientAuth";

interface User {
    id: string;
    email: string;
    displayName?: string;
    role: string;
}

const navItems = [
    { href: "/master/dashboard", label: "ภาพรวม", icon: "OV", group: "Control" },
    { href: "/master/networks", label: "เครือข่าย", icon: "NW", group: "Control" },
    { href: "/master/payments", label: "ตรวจสลิป", icon: "PY", group: "Control" },
    { href: "/master/packages", label: "แพ็คเกจ", icon: "PK", group: "Revenue" },
    { href: "/master/announcements", label: "ประกาศ", icon: "AN", group: "Revenue" },
    { href: "/master/users", label: "ผู้ใช้", icon: "US", group: "System" },
    { href: "/master/bank-settings", label: "บัญชีรับเงิน", icon: "BK", group: "System" },
    { href: "/master/contact-settings", label: "ช่องทางติดต่อ", icon: "CT", group: "System" },
    { href: "/master/settings", label: "ตั้งค่า", icon: "ST", group: "System" },
];

const pageTitles: Record<string, { title: string; subtitle: string }> = {
    "/master/dashboard": { title: "ภาพรวมระบบ", subtitle: "สถานะเครือข่าย วอลเล็ต และรายการที่ต้องจัดการ" },
    "/master/networks": { title: "จัดการเครือข่าย", subtitle: "ควบคุม tenant, อายุบริการ และฟีเจอร์แต่ละเครือข่าย" },
    "/master/payments": { title: "ตรวจสลิป", subtitle: "อนุมัติหรือตีกลับคำขอต่ออายุบริการ" },
    "/master/packages": { title: "แพ็คเกจ", subtitle: "จัดราคา ระยะเวลา และแพ็คเกจแนะนำ" },
    "/master/announcements": { title: "ประกาศ", subtitle: "ส่งข้อความหรือ popup ไปยัง tenant" },
    "/master/users": { title: "ผู้ใช้", subtitle: "จัดการสิทธิ์ master และ admin เครือข่าย" },
    "/master/bank-settings": { title: "บัญชีรับเงิน", subtitle: "ข้อมูลบัญชีสำหรับรับชำระค่าบริการ" },
    "/master/contact-settings": { title: "ช่องทางติดต่อ", subtitle: "ข้อมูลติดต่อที่ tenant เห็นเมื่อขอความช่วยเหลือ" },
    "/master/settings": { title: "ตั้งค่าระบบ", subtitle: "ความปลอดภัยและตัวแปรระบบที่ใช้ร่วมกัน" },
};

export default function MasterLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (pathname === "/master/login") {
            setLoading(false);
            return;
        }

        const token = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");

        if (!token || isTokenExpired(token)) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            router.push("/master/login");
            return;
        }

        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch {
                localStorage.removeItem("user");
            }
        }
        setLoading(false);
    }, [pathname, router]);

    const activePage = useMemo(() => {
        if (!pathname) return pageTitles["/master/dashboard"];
        if (pathname.startsWith("/master/networks/")) {
            return { title: "ตั้งค่าเครือข่าย", subtitle: "จัดการข้อมูล ฟีเจอร์ และการแจ้งเตือนของ tenant" };
        }
        return pageTitles[pathname] || { title: "Master Panel", subtitle: "ระบบควบคุมหลังบ้าน" };
    }, [pathname]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/master/login");
    };

    if (pathname === "/master/login") {
        return <ToastProvider>{children}</ToastProvider>;
    }

    if (loading) {
        return (
            <div className="loading" style={{ minHeight: "100vh" }}>
                <div className="spinner" />
            </div>
        );
    }

    let currentGroup = "";

    return (
        <ToastProvider>
            <div className="layout">
                <aside className="sidebar">
                    <div className="sidebar-logo">
                        <span className="sidebar-logo-mark">M</span>
                        <span>Master Panel</span>
                    </div>

                    <nav style={{ flex: 1 }}>
                        {navItems.map((item) => {
                            const showGroup = item.group !== currentGroup;
                            currentGroup = item.group;
                            const active = pathname === item.href || (item.href === "/master/networks" && pathname?.startsWith("/master/networks/"));
                            return (
                                <div key={item.href}>
                                    {showGroup && <div className="nav-group-label">{item.group}</div>}
                                    <Link href={item.href} className={`nav-item ${active ? "active" : ""}`}>
                                        <span className="nav-icon">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </Link>
                                </div>
                            );
                        })}
                    </nav>

                    <div className="master-sidebar-footer">
                        <div className="master-user-card">
                            <div style={{ fontSize: 14, fontWeight: 850 }}>{user?.displayName || user?.email || "Master"}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{user?.role || "MASTER"}</div>
                        </div>
                        <button onClick={handleLogout} className="btn btn-secondary" style={{ width: "100%" }}>
                            <span>ออกจากระบบ</span>
                        </button>
                    </div>
                </aside>

                <div className="main-shell">
                    <header className="master-topbar">
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span className="master-brand-mark">TM</span>
                            <div>
                                <div className="master-topbar-title">{activePage.title}</div>
                                <div className="master-topbar-subtitle">{activePage.subtitle}</div>
                            </div>
                        </div>
                        <div className="master-actions">
                            <span className="badge badge-secondary">{new Date().toLocaleDateString("th-TH")}</span>
                            <button className="btn btn-secondary btn-compact" onClick={handleLogout}>Logout</button>
                        </div>
                    </header>
                    <main className="main-content">{children}</main>
                </div>
            </div>
        </ToastProvider>
    );
}
