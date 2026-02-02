"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface ContactInfo {
    lineId: string;
    lineUrl: string;
    facebookUrl: string;
    telegramUrl: string;
    phone: string;
    email: string;
}

export default function ContactPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [contact, setContact] = useState<ContactInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("tenantToken");
        fetch(`/api/tenant/${prefix}/contact-info`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
            .then(res => res.json())
            .then(data => {
                if (data.ok) setContact(data.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [prefix]);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner" />
            </div>
        );
    }

    const hasContact = contact && (contact.lineId || contact.phone || contact.email || contact.facebookUrl || contact.telegramUrl);

    return (
        <div style={{ padding: 24 }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">📞 ช่องทางติดต่อ</h1>
                    <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
                        ติดต่อผู้ดูแลระบบผ่านช่องทางด้านล่าง
                    </p>
                </div>
            </div>

            {hasContact ? (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: 16,
                    marginTop: 24
                }}>
                    {contact.lineId && (
                        <a
                            href={contact.lineUrl || `https://line.me/ti/p/~${contact.lineId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                padding: 20,
                                background: "linear-gradient(135deg, #06c755, #00b74a)",
                                borderRadius: 12,
                                color: "#fff",
                                textDecoration: "none",
                                fontWeight: 600,
                                fontSize: 16,
                                boxShadow: "0 4px 15px rgba(6, 199, 85, 0.3)",
                                transition: "transform 0.2s"
                            }}
                        >
                            <span style={{ fontSize: 32 }}>💚</span>
                            <div>
                                <div style={{ fontSize: 14, opacity: 0.9 }}>LINE</div>
                                <div style={{ fontSize: 18 }}>{contact.lineId}</div>
                            </div>
                        </a>
                    )}

                    {contact.telegramUrl && (
                        <a
                            href={contact.telegramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                padding: 20,
                                background: "linear-gradient(135deg, #0088cc, #0077b5)",
                                borderRadius: 12,
                                color: "#fff",
                                textDecoration: "none",
                                fontWeight: 600,
                                fontSize: 16,
                                boxShadow: "0 4px 15px rgba(0, 136, 204, 0.3)",
                                transition: "transform 0.2s"
                            }}
                        >
                            <span style={{ fontSize: 32 }}>📱</span>
                            <div>
                                <div style={{ fontSize: 14, opacity: 0.9 }}>Telegram</div>
                                <div style={{ fontSize: 18 }}>คลิกเพื่อติดต่อ</div>
                            </div>
                        </a>
                    )}

                    {contact.facebookUrl && (
                        <a
                            href={contact.facebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                padding: 20,
                                background: "linear-gradient(135deg, #1877f2, #166fe5)",
                                borderRadius: 12,
                                color: "#fff",
                                textDecoration: "none",
                                fontWeight: 600,
                                fontSize: 16,
                                boxShadow: "0 4px 15px rgba(24, 119, 242, 0.3)",
                                transition: "transform 0.2s"
                            }}
                        >
                            <span style={{ fontSize: 32 }}>📘</span>
                            <div>
                                <div style={{ fontSize: 14, opacity: 0.9 }}>Facebook</div>
                                <div style={{ fontSize: 18 }}>คลิกเพื่อติดต่อ</div>
                            </div>
                        </a>
                    )}

                    {contact.phone && (
                        <a
                            href={`tel:${contact.phone}`}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                padding: 20,
                                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                borderRadius: 12,
                                color: "#fff",
                                textDecoration: "none",
                                fontWeight: 600,
                                fontSize: 16,
                                boxShadow: "0 4px 15px rgba(99, 102, 241, 0.3)",
                                transition: "transform 0.2s"
                            }}
                        >
                            <span style={{ fontSize: 32 }}>📞</span>
                            <div>
                                <div style={{ fontSize: 14, opacity: 0.9 }}>โทรศัพท์</div>
                                <div style={{ fontSize: 18 }}>{contact.phone}</div>
                            </div>
                        </a>
                    )}

                    {contact.email && (
                        <a
                            href={`mailto:${contact.email}`}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                padding: 20,
                                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                                borderRadius: 12,
                                color: "#fff",
                                textDecoration: "none",
                                fontWeight: 600,
                                fontSize: 16,
                                boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)",
                                transition: "transform 0.2s"
                            }}
                        >
                            <span style={{ fontSize: 32 }}>📧</span>
                            <div>
                                <div style={{ fontSize: 14, opacity: 0.9 }}>อีเมล</div>
                                <div style={{ fontSize: 18 }}>{contact.email}</div>
                            </div>
                        </a>
                    )}
                </div>
            ) : (
                <div style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--text-muted)"
                }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
                    <p>ยังไม่มีข้อมูลช่องทางติดต่อ</p>
                </div>
            )}
        </div>
    );
}
