"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        // Check for token and redirect appropriately
        const token = localStorage.getItem("token");
        if (token) {
            router.push("/master/dashboard");
        } else {
            router.push("/master/login");
        }
    }, [router]);

    return (
        <div className="loading" style={{ minHeight: "100vh", alignItems: "center" }}>
            <div className="spinner" />
        </div>
    );
}
