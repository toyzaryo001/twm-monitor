const INSECURE_SECRET_VALUES = new Set([
    "dev-secret-change-in-production",
    "local-dev-secret-change-me",
    "your-secret-key-here-min-32-chars",
]);

export function validateRuntimeConfig() {
    const isProduction = process.env.NODE_ENV === "production";
    if (!isProduction) return;

    const errors: string[] = [];
    const jwtSecret = process.env.JWT_SECRET || "";

    if (!process.env.DATABASE_URL) errors.push("DATABASE_URL is required");
    if (jwtSecret.length < 32 || INSECURE_SECRET_VALUES.has(jwtSecret)) {
        errors.push("JWT_SECRET must be a unique secret with at least 32 characters");
    }
    if (process.env.LOCAL_JGA88_MODE === "true") {
        errors.push("LOCAL_JGA88_MODE cannot be enabled in production");
    }
    if (errors.length > 0) {
        throw new Error(`Invalid production configuration: ${errors.join("; ")}`);
    }
}

export function getLocalJga88Credentials() {
    if (process.env.NODE_ENV === "production" || process.env.LOCAL_JGA88_MODE !== "true") {
        return null;
    }

    const username = process.env.LOCAL_JGA88_USERNAME?.trim();
    const password = process.env.LOCAL_JGA88_PASSWORD;
    if (!username || !password) return null;

    return { username, password };
}
