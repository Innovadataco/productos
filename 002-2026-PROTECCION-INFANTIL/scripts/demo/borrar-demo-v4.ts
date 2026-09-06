/**
 * SPEC-382 · BORRADOR del demo v4 — el gemelo reversible del poblador.
 *
 *   dry-run (por defecto):
 *     node --env-file=.env --import tsx scripts/demo/borrar-demo-v4.ts \
 *       --motivo="revertir demo v4 tras la prueba de BI"
 *   real:
 *     ... --confirm
 *
 * Solo toca lo que creó el v4: ids con prefijo `demo4-`.
 *
 * Por qué no roza v1/v2/v3 ni datos reales: los prefijos son DISJUNTOS —
 * "demo4-" no empieza por "demo-" (5º char es `4`), ni por "demo2-" (5º
 * char es `4`, no `2`), ni por "demo3-". Un id real jamás empieza por
 * `demo4-` (Prisma usa cuid()). El test lo prueba en las tres direcciones.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs, requerirMotivo, log, registrarAuditoriaDemo } from "./_common";
import { DEMO4 } from "./_common-v4";

const prisma = new PrismaClient();

const PFX = { startsWith: DEMO4.prefix } as const;

async function ejecutar(motivo: string, confirm: boolean) {
    log("borrar-v4", `INICIO — dry-run=${!confirm}, motivo="${motivo}"`);

    // Red de seguridad explícita: el prefijo del v4 no puede alcanzar a v1/v2/v3.
    for (const otro of ["demo-", "demo2-", "demo3-"] as const) {
        if (DEMO4.prefix.startsWith(otro) || otro.startsWith(DEMO4.prefix)) {
            throw new Error(`[borrar-v4] El prefijo del v4 se solapa con ${otro} — abortado.`);
        }
    }

    const conteos = {
        clasificaciones: await prisma.clasificacionIA.count({ where: { id: PFX } }),
        reportes: await prisma.reporte.count({ where: { id: PFX } }),
    };
    log("borrar-v4", `Encontrado: ${conteos.reportes} reportes · ${conteos.clasificaciones} clasificaciones`);

    if (!confirm) {
        log("borrar-v4", "Dry-run: no se borró nada. Pasa --confirm para ejecutar de verdad.");
        return;
    }

    const borrados = await prisma.$transaction(async (tx) => {
        const cl = await tx.clasificacionIA.deleteMany({ where: { id: PFX } });
        const rp = await tx.reporte.deleteMany({ where: { id: PFX } });
        await registrarAuditoriaDemo(tx, "demo_borrar", motivo, rp.count, {
            version: "v4",
            prefijo: DEMO4.prefix,
            clasificaciones: cl.count,
        });
        return { clasificaciones: cl.count, reportes: rp.count };
    });

    log("borrar-v4", `LISTO — ${borrados.reportes} reportes y ${borrados.clasificaciones} clasificaciones borrados.`);
}

async function main() {
    const args = parseArgs(process.argv, ["motivo", "confirm"]);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    await ejecutar(motivo, args.confirm === true);
}

if (process.argv[1]?.endsWith("borrar-demo-v4.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[borrar-v4] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
