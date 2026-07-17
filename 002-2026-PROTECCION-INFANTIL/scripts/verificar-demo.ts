#!/usr/bin/env tsx
/**
 * Verifica el estado de los reportes demo en la BD.
 * Uso:
 *   node --env-file=.env --import tsx scripts/verificar-demo.ts [--verbose]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VERBOSE = process.argv.includes("--verbose");

async function main() {
    const estados = await prisma.reporte.groupBy({
        by: ["estado"],
        where: { numeroSeguimiento: { startsWith: "RPT-DEMO-" } },
        _count: { estado: true },
    });

    console.log("=== Reportes demo por estado ===");
    const total = estados.reduce((sum, e) => sum + e._count.estado, 0);
    for (const e of estados) {
        const pct = ((e._count.estado / total) * 100).toFixed(1);
        console.log(`${e.estado.padEnd(20)} ${String(e._count.estado).padStart(4)} (${pct}%)`);
    }
    console.log("-".repeat(30));
    console.log(`${"TOTAL".padEnd(20)} ${String(total).padStart(4)}`);

    // Detalle del que esta atascado en PROCESANDO
    const procesando = await prisma.reporte.findFirst({
        where: { numeroSeguimiento: { startsWith: "RPT-DEMO-" }, estado: "PROCESANDO" },
        select: {
            id: true,
            numeroSeguimiento: true,
            identificador: true,
            texto: VERBOSE,
            ciudad: true,
            pais: true,
            creadoEn: true,
            actualizadoEn: true,
        },
    });

    if (procesando) {
        const minutos = ((Date.now() - new Date(procesando.actualizadoEn).getTime()) / 60000).toFixed(1);
        console.log("\n=== Reporte atascado en PROCESANDO ===");
        console.log(`ID:              ${procesando.id}`);
        console.log(`Seguimiento:     ${procesando.numeroSeguimiento}`);
        if (VERBOSE) {
            console.log(`Identificador:   ${procesando.identificador}`);
            console.log(`Ubicacion:       ${procesando.ciudad}, ${procesando.pais}`);
            console.log(`Texto:           ${procesando.texto?.slice(0, 100)}...`);
        }
        console.log(`Actualizado hace: ${minutos} minutos`);
    }

    // Primeros pendientes
    const pendientes = await prisma.reporte.findMany({
        where: { numeroSeguimiento: { startsWith: "RPT-DEMO-" }, estado: "PENDIENTE" },
        orderBy: { creadoEn: "asc" },
        take: 5,
        select: { id: true, numeroSeguimiento: true, identificador: VERBOSE, ciudad: VERBOSE, pais: VERBOSE },
    });
    console.log("\n=== Primeros 5 pendientes ===");
    console.table(pendientes);

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
