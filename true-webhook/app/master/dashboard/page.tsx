"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { masterFetch } from "../../lib/masterFetch";
import { EmptyState, PageHeader, StatCard, StatusBadge, TableShell } from "../components/MasterUI";

interface Stats {
    networks: number;
    users: number;
    accounts: number;
}

interface Network {
    id: string;
    prefix: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    _count: { accounts: number };
}

interface PaymentRequest {
    id: string;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [networks, setNetworks] = useState<Network[]>([]);
    const [pendingPayments, setPendingPayments] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [overview, payments] = await Promise.all([
                    masterFetch<{ ok: true; data: { stats: Stats; recentNetworks: Network[] } }>("/api/master/overview"),
                    masterFetch<{ ok: true; data: PaymentRequest[] }>("/api/master/payments?status=PENDING"),
                ]);
                setStats(overview.data.stats);
                setNetworks(overview.data.recentNetworks);
                setPendingPayments(payments.data.length);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <div>
            <PageHeader
                eyebrow="Master Overview"
                title="ภาพรวมระบบ"
                description="ดูสถานะ tenant, วอลเล็ต และรายการชำระเงินที่ต้องจัดการจากจุดเดียว"
                actions={<Link href="/master/networks" className="btn btn-primary">เพิ่มเครือข่าย</Link>}
            />

            <div className="stats-grid">
                <StatCard label="เครือข่ายทั้งหมด" value={stats?.networks || 0} meta="tenant ที่เปิดในระบบ" tone="gold" />
                <StatCard label="ผู้ใช้ทั้งหมด" value={stats?.users || 0} meta="master และ network admin" tone="cyan" />
                <StatCard label="วอลเล็ตทั้งหมด" value={stats?.accounts || 0} meta="บัญชีที่ผูกกับ tenant" tone="green" />
                <StatCard label="รอตรวจสลิป" value={pendingPayments} meta="รายการ pending" tone={pendingPayments > 0 ? "red" : "violet"} />
            </div>

            <div className="master-grid">
                <div style={{ gridColumn: "span 8" }}>
                    <TableShell>
                        <div style={{ padding: 22, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div>
                                <div className="card-title" style={{ marginBottom: 4 }}>เครือข่ายล่าสุด</div>
                                <div className="table-subtitle">tenant ที่ถูกสร้างล่าสุดในระบบ</div>
                            </div>
                            <Link href="/master/networks" className="btn btn-secondary btn-compact">ดูทั้งหมด</Link>
                        </div>
                        {networks.length === 0 ? (
                            <EmptyState
                                title="ยังไม่มีเครือข่าย"
                                description="เริ่มจากการสร้าง tenant แรก"
                                action={<Link href="/master/networks" className="btn btn-primary">สร้างเครือข่ายแรก</Link>}
                            />
                        ) : (
                            <div className="table-wrap">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>ชื่อ</th>
                                            <th>Prefix</th>
                                            <th>วอลเล็ต</th>
                                            <th>สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {networks.map((network) => (
                                            <tr key={network.id}>
                                                <td>
                                                    <div className="table-title">{network.name}</div>
                                                    <div className="table-subtitle">{new Date(network.createdAt).toLocaleDateString("th-TH")}</div>
                                                </td>
                                                <td><code>{network.prefix}</code></td>
                                                <td>{network._count.accounts}</td>
                                                <td><StatusBadge active={network.isActive} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TableShell>
                </div>

                <div style={{ gridColumn: "span 4" }}>
                    <div className="card">
                        <div className="card-title">Quick Actions</div>
                        <div style={{ display: "grid", gap: 10 }}>
                            <Link href="/master/payments" className="btn btn-secondary" style={{ justifyContent: "space-between" }}>
                                ตรวจสลิป <span className="badge badge-warning">{pendingPayments}</span>
                            </Link>
                            <Link href="/master/packages" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>จัดการแพ็คเกจ</Link>
                            <Link href="/master/announcements" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>ส่งประกาศ</Link>
                            <Link href="/master/bank-settings" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>บัญชีรับเงิน</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
