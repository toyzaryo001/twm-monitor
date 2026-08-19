import fs from "fs";
import path from "path";

interface AppVersionInfo {
    version: string;
    commit: string | null;
    buildTime: string | null;
}

let cachedVersionInfo: AppVersionInfo | null = null;

export function getAppVersionInfo(): AppVersionInfo {
    if (cachedVersionInfo) return cachedVersionInfo;

    let version = process.env.APP_VERSION || "unknown";
    try {
        const packageJson = JSON.parse(
            fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
        ) as { version?: string };
        version = process.env.APP_VERSION || packageJson.version || version;
    } catch {
        // APP_VERSION remains the fallback for packaged deployments.
    }

    cachedVersionInfo = {
        version,
        commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
        buildTime: process.env.BUILD_TIME || null,
    };
    return cachedVersionInfo;
}
