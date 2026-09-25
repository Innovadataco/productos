/**
 * SPEC-722 · Limpieza STATE-ONLY del estado sembrado en las cuentas `+e2epadre`, **preservando
 * las cuentas** (son FIJAS: el harness de Calidad se autentica con sus credenciales, no las
 * recrea; borrarlas las deja en 401).
 *
 * Por qué existe: el run VIEJO marcó la cuenta parcial como `Usuario` en la corrida del ESTADO
 * (`e2epadre-722`). `purgar-demo --corrida e2epadre-722` la borraría (Usuario está en
 * ORDEN_BORRADO). Este script quita SOLO el estado y deja las cuentas intactas:
 *   1. DESMARCA las cuentas `+e2epadre` (borra su fila `demo_marcado` Usuario/e2epadre-722, NO el
 *      Usuario) → la purga ya no las ve.
 *   2. `purgar({ corrida: e2epadre-722 })` — borra el resto del estado (hijo, reportes, círculo,
 *      cita, profesional y reportante demo) en orden FK-safe + limpia las marcas restantes.
 *   3. Verifica que las cuentas `+e2epadre` sigan VIVAS (aborta si alguna desapareció).
 *
 * dry-run puro → `--confirm`. Aborta ante flag desconocido. Idempotente (re-correr = no-op).
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/demo-prod/limpiar-estado-padre-e2e.ts            (DRY-RUN)
 *   node --env-file=.env --import tsx scripts/demo-prod/limpiar-estado-padre-e2e.ts --confirm  (APLICA)
 */
import { prisma } from "./lib/prisma";
import { purgar } from "./purgar-demo";
import { parseArgs } from "../limpieza/_common";
import { CORRIDA } from "./sembrar-estados-padre";

/** Patrón de las cuentas FIJAS de Calidad — NUNCA se borran. */
const CUENTAS_FIJAS_PATRON = "+e2epadre";

/** Ids de las cuentas fijas (cualquier estado/rol: la protección es amplia a propósito). */
async function cuentasFijasIds(): Promise<{ id: string; email: string }[]> {
    return prisma.usuario.findMany({
        where: { email: { contains: CUENTAS_FIJAS_PATRON } },
        select: { id: true, email: true },
        orderBy: { email: "asc" },
    });
}

export interface LimpiezaResult {
    cuentasFijas: number;
    marcasCuentaQuitadas: number;
    cuentasVivasDespues: number;
}

/**
 * Quita el estado de corrida `e2epadre-722` preservando las cuentas `+e2epadre`.
 * `dryRun` no escribe: reporta lo que haría.
 */
export async function limpiarEstado({ dryRun }: { dryRun: boolean }): Promise<LimpiezaResult> {
    const fijas = await cuentasFijasIds();
    const fijasIds = fijas.map((c) => c.id);
    console.log(
        `[limpiar-estado-padre-e2e] cuentas fijas ${CUENTAS_FIJAS_PATRON} (se PRESERVAN): ${fijas.length} — ${fijas.map((c) => c.email).join(", ") || "(ninguna)"}`,
    );

    const marcasCuenta = await prisma.demoMarcado.count({
        where: { entidad: "Usuario", entidadId: { in: fijasIds }, metadata: { path: ["corrida"], equals: CORRIDA } },
    });

    if (dryRun) {
        console.log(
            `[limpiar-estado-padre-e2e] DRY-RUN: desmarcaría ${marcasCuenta} cuenta(s) fija(s) de la corrida ${CORRIDA} y luego purgaría el ESTADO (abajo el detalle de la purga; las cuentas fijas NO se borran).`,
        );
        await purgar({ corrida: CORRIDA, dryRun: true });
        console.log("[limpiar-estado-padre-e2e] DRY-RUN: no se escribió nada. Corré con --confirm para limpiar.");
        return { cuentasFijas: fijas.length, marcasCuentaQuitadas: 0, cuentasVivasDespues: fijas.length };
    }

    // 1) Desmarcar las cuentas fijas → la purga ya no las toma como demo.
    const desmarcadas = await prisma.demoMarcado.deleteMany({
        where: { entidad: "Usuario", entidadId: { in: fijasIds }, metadata: { path: ["corrida"], equals: CORRIDA } },
    });
    console.log(`[limpiar-estado-padre-e2e] cuentas fijas desmarcadas de ${CORRIDA}: ${desmarcadas.count}`);

    // 2) Purgar el resto del estado (FK-safe + limpia marcas restantes).
    await purgar({ corrida: CORRIDA });

    // 3) Red de seguridad: las cuentas fijas SIGUEN vivas.
    const vivas = await prisma.usuario.count({ where: { id: { in: fijasIds } } });
    if (vivas !== fijas.length) {
        throw new Error(
            `[limpiar-estado-padre-e2e] ABORTA: se esperaban ${fijas.length} cuentas fijas vivas y quedaron ${vivas}. Revisá antes de re-sembrar.`,
        );
    }
    console.log(`[limpiar-estado-padre-e2e] Listo: estado de ${CORRIDA} purgado; ${vivas} cuenta(s) ${CUENTAS_FIJAS_PATRON} INTACTA(S).`);
    return { cuentasFijas: fijas.length, marcasCuentaQuitadas: desmarcadas.count, cuentasVivasDespues: vivas };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    const confirm = args.confirm === true;
    console.log(`[limpiar-estado-padre-e2e] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`);
    await limpiarEstado({ dryRun: !confirm });
}

if (process.argv[1]?.endsWith("limpiar-estado-padre-e2e.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[limpiar-estado-padre-e2e] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

export { cuentasFijasIds, CUENTAS_FIJAS_PATRON };
