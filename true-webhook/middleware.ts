import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Base domain - change this in production
const BASE_DOMAIN = process.env.BASE_DOMAIN || "tmw-monitors.com";

export function middleware(request: NextRequest) {
    const hostname = request.headers.get("host") || "";
    const url = request.nextUrl.clone();

    // Extract subdomain
    // hostname could be: master.tmw-monitors.com, shop1.tmw-monitors.com, localhost:3000
    let subdomain: string | null = null;

    if (hostname.includes(BASE_DOMAIN)) {
        // Production: extract subdomain from domain
        const parts = hostname.replace(`.${BASE_DOMAIN}`, "").split(".");
        if (parts.length > 0 && parts[0] !== "www" && parts[0] !== BASE_DOMAIN) {
            subdomain = parts[0];
        }
    } else if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
        // Development: use query param or header for testing
        subdomain = request.nextUrl.searchParams.get("_subdomain") || null;
    }

    // No subdomain = root domain, redirect to master
    if (!subdomain) {
        if (!url.pathname.startsWith("/master") &&
            !url.pathname.startsWith("/api") &&
            !url.pathname.startsWith("/_next") &&
            !url.pathname.startsWith("/favicon")) {
            url.pathname = "/master/login";
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    // Master subdomain
    if (subdomain === "master") {
        // Already on /master path, continue
        if (url.pathname.startsWith("/master") ||
            url.pathname.startsWith("/api") ||
            url.pathname.startsWith("/_next")) {
            return NextResponse.next();
        }
        // Rewrite to /master path
        url.pathname = `/master${url.pathname === "/" ? "/dashboard" : url.pathname}`;
        return NextResponse.rewrite(url);
    }

    // API subdomain (optional)
    if (subdomain === "api") {
        if (!url.pathname.startsWith("/api")) {
            url.pathname = `/api${url.pathname}`;
            return NextResponse.rewrite(url);
        }
        return NextResponse.next();
    }

    // Any other subdomain = Tenant
    // Rewrite to /tenant/[prefix] path
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next")) {
        return NextResponse.next();
    }

    // Store subdomain in header for API routes
    const response = NextResponse.rewrite(
        new URL(`/tenant/${subdomain}${url.pathname === "/" ? "/dashboard" : url.pathname}`, request.url)
    );
    response.headers.set("x-tenant-prefix", subdomain);
    return response;
}

export const config = {
    matcher: [
        // Match all paths except static files
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
