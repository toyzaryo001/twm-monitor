import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASE_DOMAIN = process.env.BASE_DOMAIN || "tmw-monitors.com";
const APP_ROOT = (process.env.APP_ROOT || "auto").toLowerCase();
const TENANT_PREFIX = (process.env.TENANT_PREFIX || "").toLowerCase();

function extractSubdomain(hostname: string) {
    if (!hostname.includes(BASE_DOMAIN)) return null;

    const hostWithoutPort = hostname.split(":")[0];
    const parts = hostWithoutPort.replace(`.${BASE_DOMAIN}`, "").split(".");
    const subdomain = parts[0]?.toLowerCase();

    if (subdomain && subdomain !== BASE_DOMAIN && subdomain !== "www") {
        return subdomain;
    }

    return null;
}

function rewriteTenantRoot(url: URL, tenantPrefix: string) {
    if (url.pathname === "/") {
        url.pathname = `/tenant/${tenantPrefix}/dashboard`;
        return NextResponse.rewrite(url);
    }

    if (url.pathname === "/login") {
        url.pathname = `/tenant/${tenantPrefix}/login`;
        return NextResponse.rewrite(url);
    }

    if (url.pathname.startsWith(`/tenant/${tenantPrefix}`)) {
        return NextResponse.next();
    }

    url.pathname = `/tenant/${tenantPrefix}${url.pathname}`;
    const response = NextResponse.rewrite(url);
    response.headers.set("x-tenant-prefix", tenantPrefix);
    return response;
}

export function middleware(request: NextRequest) {
    const hostname = request.headers.get("host") || "";
    const url = request.nextUrl.clone();

    if (
        url.pathname.startsWith("/_next") ||
        url.pathname.startsWith("/api") ||
        url.pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    console.log(`[middleware] root=${APP_ROOT} hostname=${hostname} path=${url.pathname}`);

    if (APP_ROOT === "master") {
        if (url.pathname === "/") {
            url.pathname = "/master/login";
            return NextResponse.redirect(url);
        }

        if (url.pathname.startsWith("/tenant")) {
            url.pathname = "/master/dashboard";
            return NextResponse.redirect(url);
        }

        if (url.pathname.startsWith("/master")) {
            return NextResponse.next();
        }

        url.pathname = `/master${url.pathname}`;
        return NextResponse.rewrite(url);
    }

    if (APP_ROOT === "tenant") {
        const tenantPrefix = TENANT_PREFIX ||
            extractSubdomain(hostname) ||
            request.nextUrl.searchParams.get("_subdomain")?.toLowerCase();

        if (!tenantPrefix) {
            return new NextResponse("TENANT_PREFIX is required for APP_ROOT=tenant", { status: 500 });
        }

        if (url.pathname.startsWith("/master")) {
            url.pathname = "/login";
            return NextResponse.redirect(url);
        }

        return rewriteTenantRoot(url, tenantPrefix);
    }

    const subdomain = extractSubdomain(hostname) ||
        (hostname.includes("localhost") || hostname.includes("127.0.0.1")
            ? request.nextUrl.searchParams.get("_subdomain")?.toLowerCase() || null
            : null);

    if (!subdomain) {
        if (url.pathname === "/") {
            url.pathname = "/master/login";
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    if (subdomain === "master") {
        if (url.pathname === "/") {
            url.pathname = "/master/dashboard";
            return NextResponse.rewrite(url);
        }
        if (url.pathname.startsWith("/master")) {
            return NextResponse.next();
        }
        url.pathname = `/master${url.pathname}`;
        return NextResponse.rewrite(url);
    }

    return rewriteTenantRoot(url, subdomain);
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};
