import { prisma } from "@/lib/prisma";

async function main() {
    const runs = await prisma.evalRun.findMany({
        orderBy: { iniciadoEn: "desc" },
        take: 5,
        select: { id: true, nombre: true, estado: true, fixtureVersion: true, iniciadoEn: true, finalizadoEn: true },
    });
    console.log("Eval runs:", JSON.stringify(runs, null, 2));
    const version = await prisma.casoEval.aggregate({ _max: { fixtureVersion: true } });
    console.log("Max fixtureVersion:", version._max.fixtureVersion);
    const casos = await prisma.casoEval.count();
    console.log("Casos eval:", casos);
}

main().finally(() => prisma.$disconnect());
