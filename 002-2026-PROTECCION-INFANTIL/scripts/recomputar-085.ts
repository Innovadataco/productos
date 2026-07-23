import { calcularMetricasSimulacion } from "../src/lib/simulacion/metricas";
import { prisma } from "../src/lib/prisma";

async function main() {
    const runs = await prisma.simulacionRun.findMany({
        where: { id: { startsWith: "cmrx12k" } },
        orderBy: { createdAt: "asc" },
    });
    console.log("| Modelo | Accuracy | Aciertos | Fallos | Silenciosos | Subestim. | SevPerdida | ESPS | Lat p50 (s) |");
    console.log("|---|---|---|---|---|---|---|---|---|");
    for (const run of runs) {
        const m = await calcularMetricasSimulacion(run.id);
        await prisma.simulacionRun.update({
            where: { id: run.id },
            data: { metricasJson: { ...(run.metricasJson as object ?? {}), ...m } as never },
        });
        console.log(
            `| ${run.modelo} | ${(m.accuracy * 100).toFixed(1)}% | ${m.aciertos} | ${m.fallos} | ${m.erroresSilenciosos.count} | ${m.subestimaciones.count} | ${m.subestimaciones.severidadPerdida} | ${m.esps} | ${(m.latenciaP50Ms / 1000).toFixed(1)} |`
        );
    }
    await prisma.$disconnect();
}
main();
