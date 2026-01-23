
import { prisma } from "../src/lib/prisma";

async function main() {
    console.log("Checking prisma client...");
    if ('financialTransaction' in prisma) {
        console.log("SUCCESS: prisma.financialTransaction exists!");
    } else {
        console.log("ERROR: prisma.financialTransaction is MISSING.");
        console.log("Available keys:", Object.keys(prisma));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
