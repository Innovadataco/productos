/**
 * SPEC-909 · Corrector de las invitaciones (colegio + comité) al copy USTED, IN-PLACE.
 *
 * Por qué hace falta (y el seed no basta en prod): el seed re-escribe el `cuerpoMarkdown`
 * y el `asunto` en un `upsert`, pero prod NO corre el seed (solo migraciones). Las filas
 * VIVAS (`notificacionPlantilla` de `colegio.invitacion.enviada.email` y
 * `comite.invitacion.enviada.email`) conservan el copy viejo (colegio en «tú», comité
 * mixto + «link»). Este corrector las trae al copy USTED canónico (Diseño SHA `446e8dc2`
 * §2) — la MISMA fuente que el seed (`INVITACIONES_USTED`), sin derivar.
 *
 * Es un fix de VOZ + FORMA: actualiza SOLO `asunto` + `cuerpoMarkdown` y PRESERVA
 * `variablesSchema`, `canal`, `activa` y `version` (§3 de la FORMA: no tocar schema/claves).
 *
 * DRY-RUN por defecto (lee e imprime); `--confirm` aplica FILA POR FILA (una que reviente
 * NO aborta a las demás — lección del lote atómico). Idempotente: una fila ya en el copy
 * canónico no se re-escribe (la 2ª corrida reporta 0 cambios). ABORTA ante flag desconocido.
 * exit≠0 si alguna fila falla.
 *
 * Uso: node --import tsx scripts/corregir-invitaciones-usted.ts [--confirm]
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { parseArgs } from "./limpieza/_common";
import { INVITACIONES_USTED } from "../prisma/invitaciones-copy.seed-data";

export interface FilaInvitacionCambio {
    clave: string;
    id: string;
}

export interface FilaInvitacionFallida {
    clave: string;
    error: string;
}

export interface ResultadoCorrectorInvitaciones {
    /** Filas vivas encontradas (una por clave). */
    encontradas: number;
    /** Filas cuyo asunto/cuerpo DIFIERE del canónico (candidatas a corregir). */
    desactualizadas: FilaInvitacionCambio[];
    /** Claves sin fila viva (nada que corregir — p. ej. una base sin ese evento sembrado). */
    clavesSinFila: string[];
    corregidas: number;
    fallidas: FilaInvitacionFallida[];
    escrito: boolean;
}

/**
 * Trae las filas vivas de las 2 invitaciones al copy USTED canónico. Recibe el
 * `PrismaClient` (no una transacción compartida): cada fila se escribe sola, con su error
 * atrapado, para que una fila envenenada no tumbe a las sanas.
 */
export async function corregirInvitacionesUsted(
    db: PrismaClient,
    opts: { dryRun: boolean }
): Promise<ResultadoCorrectorInvitaciones> {
    const desactualizadas: FilaInvitacionCambio[] = [];
    const clavesSinFila: string[] = [];
    const fallidas: FilaInvitacionFallida[] = [];
    let encontradas = 0;
    let corregidas = 0;

    for (const copy of INVITACIONES_USTED) {
        const fila = await db.notificacionPlantilla.findUnique({ where: { clave: copy.clave } });
        if (!fila) {
            clavesSinFila.push(copy.clave);
            continue;
        }
        encontradas++;
        if (fila.asunto === copy.asunto && fila.cuerpoMarkdown === copy.cuerpoMarkdown) continue; // idempotente
        desactualizadas.push({ clave: copy.clave, id: fila.id });
        if (opts.dryRun) continue;
        try {
            await db.notificacionPlantilla.update({
                where: { clave: copy.clave },
                // variablesSchema, canal, activa y version se PRESERVAN (fix de voz+forma, §3).
                data: { asunto: copy.asunto, cuerpoMarkdown: copy.cuerpoMarkdown },
            });
            corregidas++;
        } catch (e) {
            fallidas.push({ clave: copy.clave, error: e instanceof Error ? e.message : String(e) });
        }
    }

    return { encontradas, desactualizadas, clavesSinFila, corregidas, fallidas, escrito: corregidas > 0 };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    const confirm = args.confirm === true;
    console.log(
        `[corregir-invitaciones-usted] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`
    );
    const r = await corregirInvitacionesUsted(prisma, { dryRun: !confirm });
    console.log(
        `[corregir-invitaciones-usted] filas vivas: ${r.encontradas} · desactualizadas (≠ canónico usted): ${r.desactualizadas.length}`
    );
    for (const f of r.desactualizadas) console.log(`  ${f.clave} (${f.id})  →  usted`);
    if (r.clavesSinFila.length > 0) {
        console.warn(`[corregir-invitaciones-usted] claves SIN fila viva: ${r.clavesSinFila.join(", ")}`);
    }
    if (confirm) {
        console.log(`[corregir-invitaciones-usted] corregidas: ${r.corregidas}/${r.desactualizadas.length}`);
        if (r.fallidas.length > 0) {
            console.error(`[corregir-invitaciones-usted] ${r.fallidas.length} fila(s) NO se pudieron corregir:`);
            for (const f of r.fallidas) console.error(`  ✗ ${f.clave}: ${f.error}`);
            process.exitCode = 1;
        } else {
            console.log("[corregir-invitaciones-usted] Listo. Candado de voz usted exige el copy canónico.");
        }
    } else {
        console.log("[corregir-invitaciones-usted] DRY-RUN: no se escribió nada. Corré con --confirm para aplicar.");
    }
}

if (
    process.argv[1]?.endsWith("corregir-invitaciones-usted.ts") ||
    process.argv[1]?.endsWith("corregir-invitaciones-usted.js")
) {
    main()
        .catch((e) => {
            console.error(e instanceof Error ? e.message : e);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
