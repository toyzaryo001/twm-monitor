"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const prisma_1 = require("../generated/prisma");
let prisma;
if (process.env.NODE_ENV === "production") {
    exports.prisma = prisma = new prisma_1.PrismaClient();
}
else {
    if (!global.__prisma) {
        global.__prisma = new prisma_1.PrismaClient();
    }
    exports.prisma = prisma = global.__prisma;
}
