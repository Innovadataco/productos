import { prisma } from "../src/lib/prisma";

async function main() {
    const casos = await prisma.casoEval.findMany({
        where: { activo: true, fixtureVersion: 1 },
        include: {
            resultados: {
                include: { experimento: { select: { id: true, nombre: true } } },
            },
        },
        orderBy: { creadoEn: "asc" },
    });

    const runs = await prisma.evalRun.findMany({
        where: { estado: "COMPLETADA", fixtureVersion: 1 },
        select: { id: true, nombre: true },
        orderBy: { finalizadoEn: "asc" },
    });

    const payload = {
        runs: runs.map((r) => ({ id: r.id, nombre: r.nombre })),
        casos: casos.map((c) => ({
            id: c.id,
            texto: c.texto,
            categoriaEsperada: c.categoriaEsperada,
            secundariaEsperada: c.secundariaEsperada,
            ruido: c.ruido,
            resultados: c.resultados.map((r) => ({
                runId: r.experimentoId,
                runNombre: r.experimento.nombre,
                esperado: r.esperado,
                predicho: r.predicho,
                correcto: r.correcto,
                confianza: r.confianza,
            })),
        })),
    };

    console.log(JSON.stringify(payload, null, 2));
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
