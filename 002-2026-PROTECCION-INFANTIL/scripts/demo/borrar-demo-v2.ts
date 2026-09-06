/**
 * SPEC-369 · BORRADOR del demo v2 — el gemelo reversible del poblador.
 *
 *   dry-run (por defecto):
 *     node --env-file=.env --import tsx scripts/demo/borrar-demo-v2.ts \
 *       --motivo="revertir demo v2 tras la prueba de BI"
 *   real:
 *     ... --confirm
 *
 * Solo toca lo que creó el v2: ids con prefijo `demo2-`.
 *
 * Por qué no roza el v1 ni los datos reales: los prefijos son DISJUNTOS —
 * "demo2-…" no empieza por "demo-" (el quinto carácter es `2`, no `-`), y al
 * revés tampoco. Un id real jamás empieza por `demo2-` (Prisma usa cuid()).
 * Se borra primero la clasificación y después el reporte por la llave foránea.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs, requerirMotivo, log, registrarAuditoriaDemo } from "./_common";
import { DEMO2 } from "./_common-v2";

const prisma = new PrismaClient();

const PFX = { startsWith: DEMO2.prefix } as const;

async function ejecutar(motivo: string, confirm: boolean) {
    log("borrar-v2", `INICIO — dry-run=${!confirm}, motivo="${motivo}"`);

    // Red de seguridad explícita: el prefijo del v2 no puede alcanzar al v1.
    if (DEMO2.prefix.startsWith("demo-") || "demo-".startsWith(DEMO2.prefix)) {
        throw new Error("[borrar-v2] El prefijo del v2 se solapa con el del v1 — abortado.");
    }

    const conteos = {
        clasificaciones: await prisma.clasificacionIA.count({ where: { id: PFX } }),
        reportes: await prisma.reporte.count({ where: { id: PFX } }),
    };
    log("borrar-v2", `Encontrado: ${conteos.reportes} reportes · ${conteos.clasificaciones} clasificaciones`);

    if (!confirm) {
        log("borrar-v2", "Dry-run: no se borró nada. Pasa --confirm para ejecutar de verdad.");
        return;
    }

    const borrados = await prisma.$transaction(async (tx) => {
        // Primero la hija (ClasificacionIA), luego el padre (Reporte).
        const cl = await tx.clasificacionIA.deleteMany({ where: { id: PFX } });
        const rp = await tx.reporte.deleteMany({ where: { id: PFX } });
        await registrarAuditoriaDemo(tx, "demo_borrar", motivo, rp.count, {
            version: "v2",
            prefijo: DEMO2.prefix,
            clasificaciones: cl.count,
        });
        return { clasificaciones: cl.count, reportes: rp.count };
    });

    log("borrar-v2", `LISTO — ${borrados.reportes} reportes y ${borrados.clasificaciones} clasificaciones borrados.`);
}

async function main() {
    const args = parseArgs(process.argv, ["motivo", "confirm"]);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    await ejecutar(motivo, args.confirm === true);
}

if (process.argv[1]?.endsWith("borrar-demo-v2.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[borrar-v2] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
