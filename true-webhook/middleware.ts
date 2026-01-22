import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Base domain - set this in Railway environment variables
const BASE_DOMAIN = process.env.BASE_DOMAIN || "tmw-monitors.com";

export function middleware(request: NextRequest) {
    const hostname = request.headers.get("host") || "";
    const url = request.nextUrl.clone();

    // Skip for static assets and API routes
    if (
        url.pathname.startsWith("/_next") ||
        url.pathname.startsWith("/api") ||
        url.pathname.includes(".") // static files
    ) {
        return NextResponse.next();
    }

    console.log(`[middleware] hostname=${hostname} path=${url.pathname}`);

    // Extract subdomain
    let subdomain: string | null = null;

    if (hostname.includes(BASE_DOMAIN)) {
        // Production: master.tmw-monitors.com, shop1.tmw-monitors.com
        const hostWithoutPort = hostname.split(":")[0];
        const parts = hostWithoutPort.replace(`.${BASE_DOMAIN}`, "").split(".");

        // If there's a subdomain (not empty after removing base domain)
        if (parts[0] && parts[0] !== BASE_DOMAIN && parts[0] !== "www") {
            subdomain = parts[0];
        }
    } else if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
        // Development: use ?_subdomain=master or ?_subdomain=shop1
        subdomain = request.nextUrl.searchParams.get("_subdomain") || null;
    }

    // ============================================
    // ROOT DOMAIN (tmw-monitors.com) → Master Login
    // ============================================
    if (!subdomain) {
        // If accessing root directly, redirect to master login
        if (url.pathname === "/") {
            url.pathname = "/master/login";
            return NextResponse.redirect(url);
        }
        // Allow /master/* and /tenant/* paths directly
        return NextResponse.next();
    }

    // ============================================
    // MASTER SUBDOMAIN (master.tmw-monitors.com)
    // ============================================
    if (subdomain === "master") {
        // Root of master subdomain → dashboard
        if (url.pathname === "/") {
            url.pathname = "/master/dashboard";
            return NextResponse.rewrite(url);
        }
        // If already on /master path, continue
        if (url.pathname.startsWith("/master")) {
            return NextResponse.next();
        }
        // Rewrite other paths to /master/*
        url.pathname = `/master${url.pathname}`;
        return NextResponse.rewrite(url);
    }

    // ============================================
    // TENANT SUBDOMAIN (shop1.tmw-monitors.com)
    // ============================================
    // Root of tenant subdomain → dashboard
    if (url.pathname === "/") {
        url.pathname = `/tenant/${subdomain}/dashboard`;
        return NextResponse.rewrite(url);
    }

    // If path starts with /login, rewrite to tenant login
    if (url.pathname === "/login") {
        url.pathname = `/tenant/${subdomain}/login`;
        return NextResponse.rewrite(url);
    }

    // If already on correct /tenant/[prefix] path, continue
    if (url.pathname.startsWith(`/tenant/${subdomain}`)) {
        return NextResponse.next();
    }

    // Rewrite other paths to /tenant/[prefix]/*
    url.pathname = `/tenant/${subdomain}${url.pathname}`;
    const response = NextResponse.rewrite(url);
    response.headers.set("x-tenant-prefix", subdomain);
    return response;
}

export const config = {
    matcher: [
        // Match all paths except static files
        "/((?!_next/static|_next/image|favicon.ico|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};
