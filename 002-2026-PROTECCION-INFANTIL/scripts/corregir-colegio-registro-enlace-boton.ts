/**
 * SPEC-918 · Corrector IN-PLACE del correo de activación por enlace del colegio
 * (`colegio.registro_enlace.email`) al copy con BOTÓN.
 *
 * Por qué hace falta (y el seed no basta en prod): el seed re-escribe `cuerpoMarkdown` +
 * `asunto` en un `upsert`, pero prod NO corre el seed (solo migraciones). La fila VIVA
 * conserva el copy viejo con la `{{url}}` SUELTA (URL pelada). Este corrector la trae al copy
 * canónico (botón `[Activar mi cuenta]({{url}})`) — la MISMA fuente que el seed
 * (`COLEGIO_REGISTRO_ENLACE_COPIES`), sin derivar.
 *
 * Fix de FORMA: actualiza SOLO `asunto` + `cuerpoMarkdown` y PRESERVA `variablesSchema`
 * (incluida la variable `{{url}}`), `canal`, `activa` y `version`.
 *
 * DRY-RUN por defecto (lee e imprime); `--confirm` aplica FILA POR FILA (una que reviente NO
 * aborta a las demás — lección del lote atómico). Idempotente: una fila ya canónica no se
 * re-escribe (la 2ª corrida reporta 0 cambios). ABORTA ante flag desconocido. exit≠0 si falla.
 *
 * Uso: node --import tsx scripts/corregir-colegio-registro-enlace-boton.ts [--confirm]
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { parseArgs } from "./limpieza/_common";
import { COLEGIO_REGISTRO_ENLACE_COPIES } from "../prisma/colegio-registro-enlace-copy.seed-data";

export interface FilaRegistroEnlaceCambio {
    clave: string;
    id: string;
}

export interface FilaRegistroEnlaceFallida {
    clave: string;
    error: string;
}

export interface ResultadoCorrectorRegistroEnlace {
    /** Filas vivas encontradas (una por clave). */
    encontradas: number;
    /** Filas cuyo asunto/cuerpo DIFIERE del canónico (candidatas a corregir). */
    desactualizadas: FilaRegistroEnlaceCambio[];
    /** Claves sin fila viva (nada que corregir — p. ej. una base sin ese evento sembrado). */
    clavesSinFila: string[];
    corregidas: number;
    fallidas: FilaRegistroEnlaceFallida[];
    escrito: boolean;
}

/**
 * Trae la(s) fila(s) viva(s) del correo de activación por enlace al copy con botón. Recibe el
 * `PrismaClient` (no una transacción compartida): cada fila se escribe sola, con su error
 * atrapado, para que una fila envenenada no tumbe a las sanas.
 */
export async function corregirColegioRegistroEnlaceBoton(
    db: PrismaClient,
    opts: { dryRun: boolean }
): Promise<ResultadoCorrectorRegistroEnlace> {
    const desactualizadas: FilaRegistroEnlaceCambio[] = [];
    const clavesSinFila: string[] = [];
    const fallidas: FilaRegistroEnlaceFallida[] = [];
    let encontradas = 0;
    let corregidas = 0;

    for (const copy of COLEGIO_REGISTRO_ENLACE_COPIES) {
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
                // variablesSchema (incluida `{{url}}`), canal, activa y version se PRESERVAN.
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
        `[corregir-colegio-registro-enlace-boton] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`
    );
    const r = await corregirColegioRegistroEnlaceBoton(prisma, { dryRun: !confirm });
    console.log(
        `[corregir-colegio-registro-enlace-boton] filas vivas: ${r.encontradas} · desactualizadas (≠ canónico): ${r.desactualizadas.length}`
    );
    for (const f of r.desactualizadas) console.log(`  ${f.clave} (${f.id})  →  botón`);
    if (r.clavesSinFila.length > 0) {
        console.warn(`[corregir-colegio-registro-enlace-boton] claves SIN fila viva: ${r.clavesSinFila.join(", ")}`);
    }
    if (confirm) {
        console.log(`[corregir-colegio-registro-enlace-boton] corregidas: ${r.corregidas}/${r.desactualizadas.length}`);
        if (r.fallidas.length > 0) {
            console.error(`[corregir-colegio-registro-enlace-boton] ${r.fallidas.length} fila(s) NO se pudieron corregir:`);
            for (const f of r.fallidas) console.error(`  ✗ ${f.clave}: ${f.error}`);
            process.exitCode = 1;
        } else {
            console.log("[corregir-colegio-registro-enlace-boton] Listo. El candado exige el copy con botón.");
        }
    } else {
        console.log("[corregir-colegio-registro-enlace-boton] DRY-RUN: no se escribió nada. Corré con --confirm para aplicar.");
    }
}

if (
    process.argv[1]?.endsWith("corregir-colegio-registro-enlace-boton.ts") ||
    process.argv[1]?.endsWith("corregir-colegio-registro-enlace-boton.js")
) {
    main()
        .catch((e) => {
            console.error(e instanceof Error ? e.message : e);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
