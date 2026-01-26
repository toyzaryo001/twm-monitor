"use client";

/**
 * Utility for tenant API calls with automatic 401 redirect
 */
export async function tenantFetch(
    url: string,
    options: RequestInit = {},
    prefix: string
): Promise<Response> {
    const token = localStorage.getItem("tenantToken") || "";

    const res = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            "Authorization": `Bearer ${token}`,
        },
    });

    // If unauthorized, redirect to login
    if (res.status === 401) {
        localStorage.removeItem("tenantToken");
        window.location.href = `/tenant/${prefix}/login`;
        throw new Error("Session expired");
    }

    return res;
}

/**
 * Check if API response is 401 and redirect if so
 */
export function handleUnauthorized(res: Response, prefix: string): boolean {
    if (res.status === 401) {
        localStorage.removeItem("tenantToken");
        window.location.href = `/tenant/${prefix}/login`;
        return true;
    }
    return false;
}
