"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const accounts_router_1 = require("./accounts.router");
const telegram_router_1 = require("./telegram.router");
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.get('/version', (_req, res) => {
    res.status(200).json({
        name: 'true-webhook',
        version: '0.1.0',
    });
});
exports.apiRouter.use('/accounts', accounts_router_1.accountsRouter);
exports.apiRouter.use('/telegram', telegram_router_1.telegramRouter);
//# sourceMappingURL=router.js.map