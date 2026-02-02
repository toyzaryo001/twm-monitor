"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function ExpiredPage() {
    const params = useParams();
    const prefix = params.prefix as string;

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
            <div style={{
                fontSize: 64,
                marginBottom: 20
            }}>
                ⏳
            </div>
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

            <a
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
                    boxShadow: "0 4px 20px rgba(99, 102, 241, 0.3)"
                }}
            >
                🔄 ต่ออายุบริการ
            </a>
        </div>
    );
}
