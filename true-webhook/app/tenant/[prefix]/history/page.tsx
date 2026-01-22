"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Account {
    id: string;
    name: string;
    phoneNumber?: string;
}

export default function HistoryPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [loading, setLoading] = useState(true);

    const getToken = () => localStorage.getItem("tenantToken") || "";

    useEffect(() => {
        const fetchAccounts = async () => {
            const token = getToken();
            if (!token) return;

            try {
                const res = await fetch(`/api/tenant/${prefix}/accounts`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.ok) {
                    setAccounts(data.data);
                    if (data.data.length > 0) {
                        setSelectedAccount(data.data[0].id);
                    }
                }
            } catch (e) {
                console.error("Error fetching accounts", e);
            }
            setLoading(false);
        };

        fetchAccounts();
    }, [prefix]);

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            <div className="tenant-page-header">
                <h1 className="tenant-page-title">ประวัติยอดเงิน</h1>

                {accounts.length > 0 && (
                    <select
                        className="tenant-form-input"
                        style={{ width: "auto", minWidth: 200 }}
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                    >
                        {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                                {acc.name} {acc.phoneNumber ? `(${acc.phoneNumber})` : ""}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="tenant-card">
                {accounts.length === 0 ? (
                    <div className="tenant-empty">
                        <div className="tenant-empty-icon">📜</div>
                        <div className="tenant-empty-text">ยังไม่มีวอลเล็ท กรุณาเพิ่มวอลเล็ทก่อน</div>
                    </div>
                ) : (
                    <div className="tenant-empty">
                        <div className="tenant-empty-icon">📊</div>
                        <div className="tenant-empty-text">ยังไม่มีประวัติยอดเงิน</div>
                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
                            กดปุ่ม "เช็คยอด" ที่หน้า Dashboard หรือ Wallets เพื่อดึงข้อมูล
                        </p>
                    </div>
                )}

                {/* TODO: Implement balance history table when data is available */}
                {/* 
                <table style={{ width: "100%" }}>
                    <thead>
                        <tr>
                            <th>วันที่</th>
                            <th>ยอดเงิน</th>
                            <th>เปลี่ยนแปลง</th>
                        </tr>
                    </thead>
                    <tbody>
                        ...
                    </tbody>
                </table>
                */}
            </div>
        </div>
    );
}
