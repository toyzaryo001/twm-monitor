"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.generateSecret = generateSecret;
const crypto_1 = __importDefault(require("crypto"));
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
// Simple JWT implementation
function signToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const exp = Date.now() + TOKEN_EXPIRY;
    const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
    const signature = crypto_1.default
        .createHmac("sha256", JWT_SECRET)
        .update(`${header}.${body}`)
        .digest("base64url");
    return `${header}.${body}.${signature}`;
}
function verifyToken(token) {
    try {
        const [header, body, signature] = token.split(".");
        const expectedSig = crypto_1.default
            .createHmac("sha256", JWT_SECRET)
            .update(`${header}.${body}`)
            .digest("base64url");
        if (signature !== expectedSig)
            return null;
        const payload = JSON.parse(Buffer.from(body, "base64url").toString());
        if (payload.exp < Date.now())
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
// Password hashing
async function hashPassword(password) {
    const salt = crypto_1.default.randomBytes(16).toString("hex");
    const hash = crypto_1.default.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}
async function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(":");
    const testHash = crypto_1.default.scryptSync(password, salt, 64).toString("hex");
    return hash === testHash;
}
function generateSecret(length = 32) {
    return crypto_1.default.randomBytes(length).toString("hex");
}
