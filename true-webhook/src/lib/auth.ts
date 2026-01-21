// Auth utilities for JWT authentication
import crypto from 'crypto';

// JWT Secret - should be set in environment
const JWT_SECRET = process.env.JWT_SECRET || 'twm-monitor-secret-change-in-production';
const JWT_EXPIRES_IN = 60 * 60 * 24; // 24 hours in seconds
const REFRESH_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days

// Simple JWT implementation (no external deps needed)
interface JWTPayload {
    sub: string;        // User ID
    email: string;
    role: string;
    tenantId?: string;
    prefix?: string;
    iat: number;
    exp: number;
}

function base64UrlEncode(str: string): string {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64').toString('utf-8');
}

function hmacSign(data: string, secret: string): string {
    return base64UrlEncode(
        crypto.createHmac('sha256', secret).update(data).digest('base64')
    );
}

export function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn = JWT_EXPIRES_IN): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);

    const fullPayload: JWTPayload = {
        ...payload,
        iat: now,
        exp: now + expiresIn,
    };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
    const signature = hmacSign(`${headerB64}.${payloadB64}`, JWT_SECRET);

    return `${headerB64}.${payloadB64}.${signature}`;
}

export function verifyJWT(token: string): JWTPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signature] = parts;
        const expectedSig = hmacSign(`${headerB64}.${payloadB64}`, JWT_SECRET);

        if (signature !== expectedSig) return null;

        const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadB64));

        // Check expiration
        if (payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

export function generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

// Password hashing using crypto (no bcrypt needed)
export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;

    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === computedHash;
}

export { JWT_EXPIRES_IN, REFRESH_EXPIRES_IN };
