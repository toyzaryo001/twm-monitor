"use client";

export function clearMasterSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
}

export function getMasterToken() {
    return localStorage.getItem("token") || "";
}

export async function masterFetch<T = any>(url: string, init: RequestInit = {}): Promise<T> {
    const token = getMasterToken();
    const headers = new Headers(init.headers);

    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, { ...init, headers });

    if (response.status === 401) {
        clearMasterSession();
        window.location.href = "/master/login";
        throw new Error("UNAUTHORIZED");
    }

    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || `REQUEST_FAILED_${response.status}`);
    }

    return data as T;
}
