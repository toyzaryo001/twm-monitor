"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Stats {
    total: number;
    active: number;
}

interface Network {
    id: string;
    name: string;
    prefix: string;
}

export default function TenantDashboard() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [network, setNetwork] = useState<Network | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        fetch(`/api/tenant/${prefix}/stats`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.ok) {
                    setNetwork(data.data.network);
                    setStats(data.data.stats);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [prefix]);

    if (loading) {
        return <div className="loading"><div className="spinner" /></div>;
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">แดชบอร์ด - {network?.name}</h1>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats?.total || 0}</div>
                    <div className="stat-label">บัญชีทั้งหมด</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.active || 0}</div>
                    <div className="stat-label">บัญชีใช้งาน</div>
                </div>
            </div>

            <div className="card">
                <div className="card-title">ข้อมูลเครือข่าย</div>
                <table className="table">
                    <tbody>
                        <tr>
                            <td style={{ fontWeight: 500 }}>ชื่อ</td>
                            <td>{network?.name}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 500 }}>Prefix</td>
                            <td><code>{network?.prefix}</code></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
