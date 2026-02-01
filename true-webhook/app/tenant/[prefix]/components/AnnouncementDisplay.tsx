"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: "POPUP" | "MARQUEE";
    createdAt: string;
}

export default function AnnouncementDisplay({ prefix }: { prefix: string }) {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [viewedPopups, setViewedPopups] = useState<string[]>([]);
    const pathname = usePathname();

    useEffect(() => {
        // Load viewed popups from session storage
        try {
            const viewed = sessionStorage.getItem(`viewed_popups_${prefix}`);
            if (viewed) setViewedPopups(JSON.parse(viewed));
        } catch (e) {
            // ignore
        }

        const fetchAnnouncements = async () => {
            const token = localStorage.getItem("tenantToken");
            if (!token) return;

            try {
                const res = await fetch(`/api/tenant/${prefix}/announcements`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.ok) {
                    setAnnouncements(data.data);
                }
            } catch (e) {
                console.error("Error fetching announcements", e);
            }
        };

        fetchAnnouncements();

        // Poll every 60 seconds
        const interval = setInterval(fetchAnnouncements, 60000);

        return () => clearInterval(interval);
    }, [prefix, pathname]);

    const markAsViewed = (id: string) => {
        const newViewed = [...viewedPopups, id];
        setViewedPopups(newViewed);
        sessionStorage.setItem(`viewed_popups_${prefix}`, JSON.stringify(newViewed));
    };

    const marquees = announcements.filter(a => a.type === "MARQUEE");
    const popups = announcements.filter(a => a.type === "POPUP" && !viewedPopups.includes(a.id));

    return (
        <>
            {/* MARQUEE */}
            {marquees.length > 0 && (
                <div style={{
                    background: "rgba(0, 0, 0, 0.85)",
                    backdropFilter: "blur(5px)",
                    borderBottom: "1px solid rgba(255, 215, 0, 0.3)",
                    borderTop: "1px solid rgba(255, 215, 0, 0.3)",
                    color: "#FFD700",
                    padding: "8px 0",
                    position: "fixed",
                    top: 80, // Below header
                    left: 0,
                    width: "100%",
                    zIndex: 1000,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    fontSize: 16,
                    fontWeight: 600,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    textShadow: "0 0 10px rgba(255, 215, 0, 0.5)"
                }}>
                    <div className="marquee-content" style={{ display: "inline-block", paddingLeft: "100%" }}>
                        {marquees.map((m, i) => (
                            <span key={m.id} style={{ marginRight: 100, display: "inline-flex", alignItems: "center", gap: 8 }}>
                                🏆 <span style={{ color: "#fff" }}>{m.title}:</span> {m.content}
                            </span>
                        ))}
                    </div>
                    <style jsx>{`
                        @keyframes marquee {
                            0% { transform: translate(0, 0); }
                            100% { transform: translate(-100%, 0); }
                        }
                        .marquee-content {
                            animation: marquee 30s linear infinite;
                        }
                        .marquee-content:hover {
                            animation-play-state: paused;
                        }
                    `}</style>
                </div>
            )}

            {/* POPUP MODAL (Show only first unviewed popup) */}
            {popups.length > 0 && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal" style={{ maxWidth: 500 }}>
                        <h2 className="modal-title">📢 {popups[0].title}</h2>
                        <div style={{ padding: "16px 0", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                            {popups[0].content}
                        </div>
                        <div className="modal-actions">
                            <button
                                className="btn btn-primary"
                                onClick={() => markAsViewed(popups[0].id)}
                                style={{ width: "100%" }}
                            >
                                รับทราบ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
