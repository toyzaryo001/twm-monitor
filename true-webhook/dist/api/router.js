"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const master_1 = __importDefault(require("./master"));
const tenant_1 = __importDefault(require("./tenant"));
const router = (0, express_1.Router)();
// Version info
router.get("/version", (req, res) => {
    res.json({ version: "1.0.0", name: "True Webhook Monitor" });
});
// Master routes
router.use("/master", master_1.default);
// Tenant routes
router.use("/tenant/:prefix", tenant_1.default);
exports.default = router;
