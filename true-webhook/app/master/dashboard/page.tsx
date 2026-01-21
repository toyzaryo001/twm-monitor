"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    _count: { accounts: number };
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [networks, setNetworks] = useState<Network[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        fetch("/api/master/overview", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.ok) {
                    setStats(data.data.stats);
                    setNetworks(data.data.recentNetworks);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">แดชบอร์ด</h1>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats?.networks || 0}</div>
                    <div className="stat-label">เครือข่ายทั้งหมด</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.users || 0}</div>
                    <div className="stat-label">ผู้ใช้ทั้งหมด</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.accounts || 0}</div>
                    <div className="stat-label">บัญชีทั้งหมด</div>
                </div>
            </div>

            <div className="card">
                <div className="card-title">เครือข่ายล่าสุด</div>
                {networks.length === 0 ? (
                    <div className="empty-state">
                        <p>ยังไม่มีเครือข่าย</p>
                        <Link href="/master/networks" className="btn btn-primary" style={{ marginTop: 16 }}>
                            สร้างเครือข่ายแรก
                        </Link>
                    </div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>ชื่อ</th>
                                <th>Prefix</th>
                                <th>บัญชี</th>
                                <th>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {networks.map((network) => (
                                <tr key={network.id}>
                                    <td>{network.name}</td>
                                    <td><code>{network.prefix}</code></td>
                                    <td>{network._count.accounts}</td>
                                    <td>
                                        <span className={`badge ${network.isActive ? "badge-success" : "badge-error"}`}>
                                            {network.isActive ? "ใช้งาน" : "ปิด"}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
