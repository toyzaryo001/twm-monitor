type LogLevel = "debug" | "info" | "warn" | "error";

const SECRET_KEYS = /token|secret|authorization|bearer|password/i;
const MOBILE_KEYS = /mobile|phone/i;

function maskValue(key: string, value: unknown): unknown {
    if (typeof value !== "string") return value;
    if (SECRET_KEYS.test(key)) {
        return value.length <= 8 ? "***" : `${value.slice(0, 3)}***${value.slice(-3)}`;
    }
    if (MOBILE_KEYS.test(key) || /^\+?\d{7,15}$/.test(value)) {
        return value.length <= 4 ? "***" : `${value.slice(0, 3)}***${value.slice(-3)}`;
    }
    return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

export function sanitizeLogPayload(payload: unknown): unknown {
    if (!payload || typeof payload !== "object") return maskValue("", payload);
    if (Array.isArray(payload)) return payload.slice(0, 20).map(sanitizeLogPayload);

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>).slice(0, 40)) {
        if (value && typeof value === "object") {
            sanitized[key] = sanitizeLogPayload(value);
        } else {
            sanitized[key] = maskValue(key, value);
        }
    }
    return sanitized;
}

export function logEvent(level: LogLevel, event: string, data: Record<string, unknown> = {}) {
    const entry = {
        ts: new Date().toISOString(),
        level,
        event,
        ...sanitizeLogPayload(data) as Record<string, unknown>,
    };

    const message = JSON.stringify(entry);
    if (level === "error") {
        console.error(message);
    } else if (level === "warn") {
        console.warn(message);
    } else {
        console.log(message);
    }
}
