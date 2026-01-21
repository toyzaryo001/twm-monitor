"use client";

import { useState } from "react";

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkHealth() {
    setError(null);
    setHealth(null);

    if (!apiBase) {
      setError("Missing NEXT_PUBLIC_API_BASE_URL");
      return;
    }

    const res = await fetch(`${apiBase}/health`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(`Health check failed: ${res.status}`);
      setHealth(json);
      return;
    }

    setHealth(json);
  }

  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>TWM Monitor (Web)</h1>
      <p style={{ marginTop: 8, color: "#666" }}>
        API Base: <code>{apiBase ?? "(not set)"}</code>
      </p>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={checkHealth}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ddd",
            cursor: "pointer",
          }}
        >
          Check API Health
        </button>
      </div>

      {error ? (
        <pre style={{ marginTop: 16, color: "crimson" }}>{error}</pre>
      ) : null}

      {health ? (
        <pre style={{ marginTop: 16 }}>{JSON.stringify(health, null, 2)}</pre>
      ) : null}
    </main>
  );
}
