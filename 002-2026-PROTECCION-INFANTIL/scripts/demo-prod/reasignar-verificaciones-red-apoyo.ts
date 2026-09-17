/**
 * I-418 · Reasignar el FIRMANTE de las verificaciones SEMBRADAS por la Red de Apoyo.
 *
 * El poblador viejo firmaba sus ~50 verificaciones con un ADMIN REAL (`findFirst rol ADMIN` →
 * `revisadoPorId`): deja registros demo con AUTORÍA de una persona que no las revisó. Este
 * corrector las reasigna al VERIFICADOR demo SIN ACCESO (clave aleatoria + `estado=inactivo`;
 * ver `asegurarVerificadorDemoSinAcceso`). La RAÍZ ya quedó arreglada: el poblador ahora firma con
 * ese mismo verificador (fuente única `EMAIL_VERIFICADOR_DEMO_RED`), así una re-siembra no reintroduce
 * la autoría real. (Corrige el dato viejo + arregla la raíz — [[dev-corrector-idempotente-no-es-no-destructivo]].)
 *
 * SELECCIÓN POR LA MARCA DE LA CORRIDA (`red-apoyo-676`): solo toca verificaciones marcadas en
 * `demo_marcado` con esa corrida. Una verificación REAL nunca está marcada → NUNCA se toca. Es
 * estructural, no una condición que se pueda olvidar.
 *
 * Idempotente: reasigna solo las que aún NO apuntan al verificador demo; re-correr reasigna 0.
 * Transacción: crea/asegura el verificador y reasigna en la MISMA tx. Conteo ANTES y DESPUÉS.
 * Aborta ante CUALQUIER flag desconocido (un flag tragado corre en un modo que nadie pidió).
 *
 * Datos gatea; lo corre en PRODUCCIÓN el CEO — Datos no escribe prod a mano.
 * Uso (dev):
 *   node --env-file=.env --import tsx scripts/demo-prod/reasignar-verificaciones-red-apoyo.ts            # dry-run
 *   node --env-file=.env --import tsx scripts/demo-prod/reasignar-verificaciones-red-apoyo.ts --confirm  # escribe
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "./lib/prisma";
import { CORRIDA_RED, SCRIPT_RED, EMAIL_VERIFICADOR_DEMO_RED } from "./lib/red-apoyo-plan";
import { asegurarVerificadorDemoSinAcceso } from "./lib/verificador-demo-sin-acceso";

export interface ResultadoReasignacion {
    verificadorDemoId: string | null; // null en dry-run si el verificador aún no existe
    verificadorExiste: boolean;
    marcadas: number;
    yaAlDemo: number;
    porReasignar: number;
    despuesAlDemo: number;
    firmantesAntes: { revisadoPorId: string; cuenta: number }[];
    escrito: boolean;
}

/**
 * Reasigna, dentro de `tx`, las verificaciones marcadas `red-apoyo-676` al verificador demo sin
 * acceso. Devuelve los conteos antes/después.
 *
 * `dryRun` es PURO: NO escribe NADA. No crea el verificador (solo lo BUSCA) — un dry-run tiene que
 * dejar la base IDÉNTICA (candado). Solo la corrida real (`--confirm`) asegura el verificador y reasigna.
 */
export async function reasignarVerificacionesRedApoyo(
    tx: Prisma.TransactionClient,
    opts: { dryRun: boolean },
): Promise<ResultadoReasignacion> {
    // IDs de las verificaciones SEMBRADAS por la Red de Apoyo (marca de la corrida). Solo estas.
    const marcas = await tx.demoMarcado.findMany({
        where: { entidad: "VerificacionProfesional", metadata: { path: ["corrida"], equals: CORRIDA_RED } },
        select: { entidadId: true },
    });
    const ids = marcas.map((m) => m.entidadId);

    // ANTES: quién firma hoy esas verificaciones (grupo por revisadoPorId). Solo lectura.
    const grupos = ids.length
        ? await tx.verificacionProfesional.groupBy({ by: ["revisadoPorId"], where: { id: { in: ids } }, _count: { _all: true } })
        : [];
    const firmantesAntes = grupos
        .map((g) => ({ revisadoPorId: g.revisadoPorId, cuenta: g._count._all }))
        .sort((a, b) => b.cuenta - a.cuenta);

    if (opts.dryRun) {
        // NO escribe: solo BUSCA el verificador (puede no existir todavía) y pronostica.
        const verificador = await tx.usuario.findUnique({ where: { email: EMAIL_VERIFICADOR_DEMO_RED }, select: { id: true } });
        const yaAlDemo = verificador ? (firmantesAntes.find((f) => f.revisadoPorId === verificador.id)?.cuenta ?? 0) : 0;
        return {
            verificadorDemoId: verificador?.id ?? null,
            verificadorExiste: verificador !== null,
            marcadas: ids.length,
            yaAlDemo,
            porReasignar: ids.length - yaAlDemo,
            despuesAlDemo: yaAlDemo,
            firmantesAntes,
            escrito: false,
        };
    }

    // Escritura (--confirm): asegura el verificador demo y reasigna las que aún no lo apuntan.
    const verificadorDemoId = await asegurarVerificadorDemoSinAcceso(tx, {
        corrida: CORRIDA_RED,
        script: SCRIPT_RED,
        email: EMAIL_VERIFICADOR_DEMO_RED,
    });
    const yaAlDemo = firmantesAntes.find((f) => f.revisadoPorId === verificadorDemoId)?.cuenta ?? 0;
    const porReasignar = ids.length - yaAlDemo;
    if (porReasignar > 0) {
        await tx.verificacionProfesional.updateMany({
            where: { id: { in: ids }, revisadoPorId: { not: verificadorDemoId } },
            data: { revisadoPorId: verificadorDemoId },
        });
    }
    const despuesAlDemo = await tx.verificacionProfesional.count({ where: { id: { in: ids }, revisadoPorId: verificadorDemoId } });

    return { verificadorDemoId, verificadorExiste: true, marcadas: ids.length, yaAlDemo, porReasignar, despuesAlDemo, firmantesAntes, escrito: true };
}

/** Aborta ante cualquier flag no reconocido (no tragar flags en un script que escribe prod). */
function parsearArgs(argv: string[]): { dryRun: boolean } {
    const args = argv.slice(2);
    const permitidas = new Set(["--confirm", "--dry-run"]);
    const desconocidas = args.filter((a) => !permitidas.has(a));
    if (desconocidas.length > 0) {
        throw new Error(`[reasignar-verif-redapoyo] flag(s) desconocido(s): ${desconocidas.join(", ")} — aborto sin escribir.`);
    }
    return { dryRun: !args.includes("--confirm") };
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) throw new Error("[reasignar-verif-redapoyo] DATABASE_URL requerida");
    if (process.env.NODE_ENV === "test") throw new Error("[reasignar-verif-redapoyo] NODE_ENV=test bloqueado — este script no corre en tests");

    const { dryRun } = parsearArgs(process.argv);

    const r = await prisma.$transaction((tx) => reasignarVerificacionesRedApoyo(tx, { dryRun }));

    console.log("");
    console.log(`[reasignar-verif-redapoyo] ${dryRun ? "DRY-RUN (sin --confirm, NO escribe nada)" : "ESCRITO"}`);
    console.log(`  verificador demo (firmante): ${r.verificadorDemoId ?? "(no existe aún — se crearía al confirmar)"}`);
    console.log(`  verificaciones marcadas ${CORRIDA_RED}: ${r.marcadas}`);
    console.log("  firmantes ANTES:");
    for (const f of r.firmantesAntes) {
        const cual = f.revisadoPorId === r.verificadorDemoId ? " (verificador demo)" : " (otro — a reasignar)";
        console.log(`    ${f.revisadoPorId}: ${f.cuenta}${cual}`);
    }
    console.log(`  ${dryRun ? "se reasignarían" : "reasignadas"}: ${r.porReasignar} · ya al demo: ${r.yaAlDemo}`);
    console.log(`  DESPUÉS al verificador demo: ${r.despuesAlDemo}${!dryRun ? (r.despuesAlDemo === r.marcadas ? " ✅ (= marcadas)" : " ⚠️ ¡no todas!") : ""}`);
}

if (process.argv[1]?.endsWith("reasignar-verificaciones-red-apoyo.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[reasignar-verif-redapoyo] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
