"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ContactInfo {
    lineId: string;
    lineUrl: string;
    facebookUrl: string;
    telegramUrl: string;
    phone: string;
    email: string;
}

export default function ExpiredPage() {
    const params = useParams();
    const prefix = params.prefix as string;
    const [contact, setContact] = useState<ContactInfo | null>(null);

    useEffect(() => {
        fetch(`/api/tenant/${prefix}/contact-info`)
            .then(res => res.json())
            .then(data => {
                if (data.ok) setContact(data.data);
            })
            .catch(console.error);
    }, [prefix]);

    const hasContact = contact && (contact.lineId || contact.phone || contact.email || contact.facebookUrl || contact.telegramUrl);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "#121212",
            color: "#fff",
            fontFamily: "Inter, sans-serif",
            textAlign: "center",
            padding: 20
        }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>⏳</div>
            <h1 style={{
                fontSize: 32,
                fontWeight: 700,
                marginBottom: 16,
                color: "#ff4d4d"
            }}>
                บริการหมดอายุ (Service Suspended)
            </h1>
            <p style={{
                fontSize: 16,
                color: "#aaa",
                maxWidth: 500,
                lineHeight: 1.6,
                marginBottom: 32
            }}>
                เครือข่าย <strong>{prefix?.toUpperCase()}</strong> ของคุณหมดอายุการใช้งานแล้ว
                <br />
                กรุณาติดต่อผู้ดูแลระบบเพื่อต่ออายุการใช้งาน และเข้าถึงข้อมูลได้อีกครั้ง
            </p>
            <div style={{
                padding: "16px 32px",
                background: "#1e1e1e",
                borderRadius: 8,
                border: "1px solid #333",
                marginBottom: 24
            }}>
                ID: {prefix}
            </div>

            <Link
                href={`/tenant/${prefix}/packages`}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "16px 32px",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "white",
                    borderRadius: 12,
                    fontSize: 18,
                    fontWeight: 600,
                    textDecoration: "none",
                    transition: "all 0.2s",
                    boxShadow: "0 4px 20px rgba(99, 102, 241, 0.3)",
                    marginBottom: 32
                }}
            >
                🔄 ต่ออายุบริการ
            </Link>

            {/* Contact Section */}
            {hasContact && (
                <div style={{
                    marginTop: 24,
                    padding: 24,
                    background: "#1e1e1e",
                    borderRadius: 12,
                    border: "1px solid #333",
                    maxWidth: 400,
                    width: "100%"
                }}>
                    <h3 style={{
                        fontSize: 18,
                        fontWeight: 600,
                        marginBottom: 16,
                        color: "#fff"
                    }}>
                        📞 ช่องทางติดต่อ
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {contact.lineId && (
                            <a
                                href={contact.lineUrl || `https://line.me/ti/p/~${contact.lineId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "12px 16px",
                                    background: "#06c755",
                                    borderRadius: 8,
                                    color: "#fff",
                                    textDecoration: "none",
                                    fontWeight: 500
                                }}
                            >
                                💚 LINE: {contact.lineId}
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
                                    gap: 12,
                                    padding: "12px 16px",
                                    background: "#0088cc",
                                    borderRadius: 8,
                                    color: "#fff",
                                    textDecoration: "none",
                                    fontWeight: 500
                                }}
                            >
                                📱 Telegram
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
                                    gap: 12,
                                    padding: "12px 16px",
                                    background: "#1877f2",
                                    borderRadius: 8,
                                    color: "#fff",
                                    textDecoration: "none",
                                    fontWeight: 500
                                }}
                            >
                                📘 Facebook
                            </a>
                        )}
                        {contact.phone && (
                            <a
                                href={`tel:${contact.phone}`}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "12px 16px",
                                    background: "#333",
                                    borderRadius: 8,
                                    color: "#fff",
                                    textDecoration: "none",
                                    fontWeight: 500
                                }}
                            >
                                📞 โทร: {contact.phone}
                            </a>
                        )}
                        {contact.email && (
                            <a
                                href={`mailto:${contact.email}`}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "12px 16px",
                                    background: "#333",
                                    borderRadius: 8,
                                    color: "#fff",
                                    textDecoration: "none",
                                    fontWeight: 500
                                }}
                            >
                                📧 {contact.email}
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
