/**
 * SPEC-371 · BORRADOR del demo v3 — revierte exactamente lo que puso el poblador.
 *
 *   dry-run (por defecto): node --env-file=.env --import tsx scripts/demo/borrar-demo-v3.ts --motivo="..."
 *   real:                  ... --confirm
 *
 * Tres reversas, en el orden inverso al poblado:
 *  1) Alertas que el v3 pasó a "gestionada" al resolver su solicitud → vuelven a
 *     "escalada". Se identifican por SUS PROPIAS solicitudes `demo3-` RESUELTAS
 *     (antes de borrarlas), así no se toca ninguna alerta gestionada por otra vía.
 *  2) Se borran las solicitudes y transiciones `demo3-` (ids propios, disjuntos
 *     de `demo-` y `demo2-`). Los reportes NO se tocan.
 *  3) Asignaciones: `asignadoAId` vuelve a NULL SOLO en alertas `demo-al-` de
 *     colegios `demo-c-` cuyo asignado sea un comité demo `demo-u-cvi-` (v1 nunca
 *     asigna; en prod estaba 100 % NULL). Una alerta real no puede calzar.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs, requerirMotivo, log, registrarAuditoriaDemo } from "./_common";
import { DEMO3 } from "./_common-v3";

const prisma = new PrismaClient();
const PFX = { startsWith: DEMO3.prefix } as const;

async function ejecutar(motivo: string, confirm: boolean) {
    log("borrar-v3", `INICIO — dry-run=${!confirm}, motivo="${motivo}"`);

    if ("demo-".startsWith(DEMO3.prefix) || DEMO3.prefix.startsWith("demo-") || DEMO3.prefix.startsWith("demo2-")) {
        throw new Error("[borrar-v3] El prefijo del v3 se solapa con v1/v2 — abortado.");
    }

    const resueltas = await prisma.solicitudComite.findMany({
        where: { id: PFX, estado: "RESUELTA", alertaColegioId: { not: null } },
        select: { alertaColegioId: true },
    });
    const alertasARevertir = resueltas.map((s) => s.alertaColegioId as string);

    const conteos = {
        alertasAEscalada: alertasARevertir.length,
        solicitudes: await prisma.solicitudComite.count({ where: { id: PFX } }),
        transiciones: await prisma.transicionReporte.count({ where: { id: PFX } }),
        asignaciones: await prisma.alertaColegio.count({
            where: { id: { startsWith: "demo-al-" }, colegioId: { startsWith: "demo-c-" }, asignadoAId: { startsWith: "demo-u-cvi-" } },
        }),
    };
    log("borrar-v3", `Encontrado: ${JSON.stringify(conteos)}`);

    if (!confirm) {
        log("borrar-v3", "Dry-run: no se borró nada. Pasa --confirm para ejecutar de verdad.");
        return;
    }

    const hecho = await prisma.$transaction(async (tx) => {
        const aEscalada = alertasARevertir.length
            ? (await tx.alertaColegio.updateMany({
                where: { id: { in: alertasARevertir, startsWith: "demo-al-" }, colegioId: { startsWith: "demo-c-" }, estado: "gestionada" },
                data: { estado: "escalada" },
            })).count
            : 0;
        const sol = await tx.solicitudComite.deleteMany({ where: { id: PFX } });
        const tr = await tx.transicionReporte.deleteMany({ where: { id: PFX } });
        const asig = await tx.alertaColegio.updateMany({
            where: { id: { startsWith: "demo-al-" }, colegioId: { startsWith: "demo-c-" }, asignadoAId: { startsWith: "demo-u-cvi-" } },
            data: { asignadoAId: null },
        });
        await registrarAuditoriaDemo(tx, "demo_borrar", motivo, sol.count + tr.count + asig.count, {
            version: "v3",
            prefijo: DEMO3.prefix,
            alertasAEscalada: aEscalada,
            solicitudes: sol.count,
            transiciones: tr.count,
            asignaciones: asig.count,
        });
        return { aEscalada, solicitudes: sol.count, transiciones: tr.count, asignaciones: asig.count };
    });

    log("borrar-v3", `LISTO — ${JSON.stringify(hecho)}`);
}

async function main() {
    const args = parseArgs(process.argv);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    await ejecutar(motivo, args.confirm === true);
}

if (process.argv[1]?.endsWith("borrar-demo-v3.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[borrar-v3] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
