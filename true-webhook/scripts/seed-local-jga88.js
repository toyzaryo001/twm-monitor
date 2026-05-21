const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

async function main() {
    const prisma = new PrismaClient();

    try {
        const network = await prisma.network.upsert({
            where: { prefix: "jga88" },
            update: {
                name: "JGA88",
                isActive: true,
                realtimeEnabled: false,
            },
            create: {
                prefix: "jga88",
                name: "JGA88",
                isActive: true,
                realtimeEnabled: false,
            },
        });

        await prisma.user.upsert({
            where: { email: "jga88" },
            update: {
                passwordHash: hashPassword("Jga112233"),
                displayName: "JGA88 Admin",
                role: "NETWORK_ADMIN",
                networkId: network.id,
            },
            create: {
                email: "jga88",
                passwordHash: hashPassword("Jga112233"),
                displayName: "JGA88 Admin",
                role: "NETWORK_ADMIN",
                networkId: network.id,
            },
        });

        console.log("[seed-local-jga88] Network: jga88");
        console.log("[seed-local-jga88] Login: jga88 / Jga112233");
    } catch (e) {
        console.error("[seed-local-jga88] Error:", e.message);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main();
