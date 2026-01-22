const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return salt + ":" + hash;
}

async function main() {
    const prisma = new PrismaClient();
    try {
        await prisma.user.deleteMany({ where: { email: "superTT" } });

        await prisma.user.create({
            data: {
                email: "superTT",
                passwordHash: hashPassword("Tt112233"),
                displayName: "Super Admin",
                role: "MASTER"
            }
        });
        console.log("[seed] Created admin: superTT / Tt112233");
    } catch (e) {
        console.error("[seed] Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
