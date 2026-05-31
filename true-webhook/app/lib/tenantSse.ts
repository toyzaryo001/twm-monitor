"use client";

export async function openTenantBalanceStream(prefix: string, accountId: string): Promise<EventSource> {
    const token = localStorage.getItem("tenantToken") || "";
    const response = await fetch(`/api/tenant/${prefix}/sse-ticket?accountId=${encodeURIComponent(accountId)}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
        localStorage.removeItem("tenantToken");
        window.location.href = `/tenant/${prefix}/login`;
        throw new Error("SSE_UNAUTHORIZED");
    }

    const body = await response.json();
    const ticket = body?.data?.ticket;

    if (!response.ok || !body?.ok || typeof ticket !== "string") {
        throw new Error(body?.error || "SSE_TICKET_FAILED");
    }

    return new EventSource(`/api/sse/balance/${accountId}?ticket=${encodeURIComponent(ticket)}`);
}
