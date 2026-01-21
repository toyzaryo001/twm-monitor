"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireMaster = requireMaster;
exports.requireNetworkAccess = requireNetworkAccess;
const auth_1 = require("../lib/auth");
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    const token = authHeader.substring(7);
    const payload = (0, auth_1.verifyToken)(token);
    if (!payload) {
        return res.status(401).json({ ok: false, error: "INVALID_TOKEN" });
    }
    req.user = payload;
    next();
}
function requireMaster(req, res, next) {
    if (req.user?.role !== "MASTER") {
        return res.status(403).json({ ok: false, error: "MASTER_REQUIRED" });
    }
    next();
}
function requireNetworkAccess(req, res, next) {
    const { prefix } = req.params;
    // Master can access all networks
    if (req.user?.role === "MASTER") {
        return next();
    }
    // Check if user belongs to this network (by prefix lookup needed)
    // For now, allow NETWORK_ADMIN and NETWORK_USER
    if (req.user?.role === "NETWORK_ADMIN" || req.user?.role === "NETWORK_USER") {
        return next();
    }
    return res.status(403).json({ ok: false, error: "NETWORK_ACCESS_DENIED" });
}
