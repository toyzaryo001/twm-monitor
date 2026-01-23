import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    networkId?: string | null;
}

// Simple JWT implementation
export function signToken(payload: TokenPayload, expiresIn: number = TOKEN_EXPIRY): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const exp = Date.now() + expiresIn;
    const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
    const signature = crypto
        .createHmac("sha256", JWT_SECRET)
        .update(`${header}.${body}`)
        .digest("base64url");
    return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
    try {
        const [header, body, signature] = token.split(".");
        const expectedSig = crypto
            .createHmac("sha256", JWT_SECRET)
            .update(`${header}.${body}`)
            .digest("base64url");

        if (signature !== expectedSig) return null;

        const payload = JSON.parse(Buffer.from(body, "base64url").toString());
        if (payload.exp < Date.now()) return null;

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
    const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return hash === testHash;
}

export function generateSecret(length = 32): string {
    return crypto.randomBytes(length).toString("hex");
}
