import crypto from "crypto";

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SSE_TICKET_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes

interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    networkId?: string | null;
}

interface SseTicketPayload {
    accountId: string;
    networkId: string;
    userId: string;
    exp: number;
    purpose: "sse_balance";
}

function signBody(body: string, header: string): string {
    return crypto
        .createHmac("sha256", getJwtSecret())
        .update(`${header}.${body}`)
        .digest("base64url");
}

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET is required in production");
    }
    return "dev-secret-change-in-production";
}

function signaturesMatch(actual: string | undefined, expected: string) {
    if (!actual) return false;
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

// Simple JWT implementation
export function signToken(payload: TokenPayload, expiresIn: number = TOKEN_EXPIRY_MS): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const exp = Math.floor((Date.now() + expiresIn) / 1000);
    const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
    const signature = signBody(body, header);
    return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
    try {
        const [header, body, signature] = token.split(".");
        const expectedSig = signBody(body, header);

        if (!signaturesMatch(signature, expectedSig)) return null;

        const payload = JSON.parse(Buffer.from(body, "base64url").toString());
        const exp = Number(payload.exp);
        const expMs = exp < 10_000_000_000 ? exp * 1000 : exp;
        if (!Number.isFinite(expMs) || expMs < Date.now()) return null;

        return payload;
    } catch {
        return null;
    }
}

export function signSseTicket(payload: Omit<SseTicketPayload, "exp" | "purpose">): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "SSE" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({
        ...payload,
        purpose: "sse_balance",
        exp: Math.floor((Date.now() + SSE_TICKET_EXPIRY_MS) / 1000),
    })).toString("base64url");
    const signature = signBody(body, header);
    return `${header}.${body}.${signature}`;
}

export function verifySseTicket(ticket: string, accountId: string): SseTicketPayload | null {
    try {
        const [header, body, signature] = ticket.split(".");
        const expectedSig = signBody(body, header);
        if (!signaturesMatch(signature, expectedSig)) return null;

        const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SseTicketPayload;
        if (payload.purpose !== "sse_balance") return null;
        if (payload.accountId !== accountId) return null;
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;
        if (!payload.networkId || !payload.userId) return null;

        return payload;
    } catch {
        return null;
    }
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
    const expected = Buffer.from(hash, "hex");
    const actual = Buffer.from(testHash, "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function generateSecret(length = 32): string {
    return crypto.randomBytes(length).toString("hex");
}
