/**
 * SPEC-922 · Corrector IN-PLACE data-driven del REGISTRO ÚNICO de copys canónicos
 * (`prisma/correos-canonicos.seed-data.ts`).
 *
 * Itera `CORREOS_CANONICOS` —la MISMA fuente que el seed y el candado—. Las familias siguientes del
 * barrido NO tocan este archivo: appendean al registro y el corrector las cubre solo.
 *
 * Es el ÚNICO camino del copy canónico a una fila VIVA (VEREDICTO CEO 19-11): el seed es CREATE-ONLY
 * porque el panel admin edita plantillas, así que traer una fila al canónico es un acto DELIBERADO.
 *   - DRY-RUN (por defecto): lista fila por fila QUÉ difiere (asunto/cuerpo), su versión y si la
 *     editaron en el panel — para decidir antes de pisar una edición. No escribe nada.
 *   - `--confirm`: aplica FILA POR FILA (una que reviente NO aborta a las demás — lección del lote
 *     atómico). Idempotente: una fila ya canónica no se re-escribe.
 *   - `--aviso`: DETECTOR de deriva para el final del deploy. Solo lectura, una línea
 *     («N plantillas difieren del canónico → corré el corrector»). El deploy lo corre con `|| echo`:
 *     nunca lo tumba, y NUNCA aplica — eso queda para el `--confirm` deliberado.
 *
 * Escribe `asunto` + `cuerpoMarkdown` y hace un merge ADITIVO de `variablesSchema` (AJUSTE CEO 19-11):
 * agrega las variables que el canónico declara y la fila viva no tiene —p. ej. la `{{url}}` de un botón
 * nuevo, que sin declarar deja la vista previa del panel con el enlace vacío—, y NUNCA quita ni cambia
 * las existentes (las que agregó el admin quedan). PRESERVA `activa` (una plantilla DEROGADA o
 * desactivada por el admin sigue inactiva), `canal` y `version`. ABORTA ante flag desconocido
 * (`--confirmar` no es `--confirm`) y ante `--confirm` + `--aviso` juntos. exit≠0 si una fila falla.
 *
 * Uso: node --import tsx scripts/corregir-correos-canonicos.ts [--confirm | --aviso]
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { parseArgs } from "./limpieza/_common";
import { CORREOS_CANONICOS } from "../prisma/correos-canonicos.seed-data";
import { COPYS_HUERFANOS, COPYS_PENDIENTES, violacionesCobertura } from "../prisma/correos-canonicos.pendientes";

const TAG = "[corregir-correos-canonicos]";

/**
 * GUARDIÁN BLANDO de cobertura contra la TABLA VIVA (deploy `--aviso`). CI solo ve el seed fresco; la
 * BD viva puede tener claves que el seed ya no crea (p. ej. una huérfana nueva) — este scan las caza.
 * Solo lectura; devuelve las violaciones de cobertura (la fila viva fuera de registro ∪ pendientes ∪
 * huérfanas). No bloquea el deploy: el que lo corre decide.
 */
export async function escanearCoberturaViva(db: Pick<PrismaClient, "notificacionPlantilla">): Promise<string[]> {
    const vivas = (await db.notificacionPlantilla.findMany({ select: { clave: true } })).map((p) => p.clave);
    return violacionesCobertura(
        { vivas },
        CORREOS_CANONICOS.map((c) => c.clave),
        COPYS_PENDIENTES.map((p) => p.clave),
        COPYS_HUERFANOS.map((h) => h.clave)
    );
}

export const FLAGS_CORRECTOR = ["confirm", "aviso"] as const;

export type ModoCorrector = "dry-run" | "confirm" | "aviso";

/** Parsea la línea de comandos. ABORTA (throw) ante flag desconocido o `--confirm` + `--aviso`. */
export function parsearArgsCorrector(argv: string[]): { modo: ModoCorrector } {
    const args = parseArgs(argv, FLAGS_CORRECTOR);
    const confirm = args.confirm === true;
    const aviso = args.aviso === true;
    if (confirm && aviso) {
        throw new Error(`${TAG} --confirm y --aviso son excluyentes: el aviso es solo lectura. ABORTA sin escribir nada.`);
    }
    return { modo: confirm ? "confirm" : aviso ? "aviso" : "dry-run" };
}

export interface FilaCopyCambio {
    clave: string;
    id: string;
    /** Qué difiere del canónico (`schema` = le faltan variables que el canónico declara). */
    campos: ("asunto" | "cuerpo" | "schema")[];
    /** Variables que el merge aditivo le agrega al `variablesSchema` de la fila. */
    variablesNuevas: string[];
    version: number;
    /** La tocó un admin desde el panel (`actualizadaPor`): pisarla revierte esa edición. */
    editadaEnPanel: boolean;
}

export interface FilaCopyFallida {
    clave: string;
    error: string;
}

export interface ResultadoCorrectorCopys {
    /** Filas vivas encontradas (una por clave del registro). */
    encontradas: number;
    /** Filas cuyo asunto/cuerpo DIFIERE del canónico (candidatas a corregir). */
    desactualizadas: FilaCopyCambio[];
    /** Claves del registro sin fila viva (nada que corregir; el seed las crea). */
    clavesSinFila: string[];
    corregidas: number;
    fallidas: FilaCopyFallida[];
    escrito: boolean;
}

interface FilaLeida {
    id: string;
    asunto: string | null;
    cuerpoMarkdown: string;
    version: number;
    actualizadaPor: string | null;
    variablesSchema: unknown;
}

function esObjeto(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Merge ADITIVO del `variablesSchema`: agrega a la fila viva las `properties` que el canónico declara y
 * ella no tiene. Nunca quita ni cambia una clave existente (de la fila o agregada por el admin).
 */
export function mergeSchemaAditivo(
    vivo: unknown,
    canonico: Record<string, unknown>
): { schema: Record<string, unknown>; nuevas: string[] } {
    const base = esObjeto(vivo) ? vivo : {};
    const propsVivo = esObjeto(base.properties) ? base.properties : {};
    const propsCanon = esObjeto(canonico.properties) ? canonico.properties : {};
    const nuevas = Object.keys(propsCanon).filter((k) => !(k in propsVivo));
    if (nuevas.length === 0) return { schema: base, nuevas };
    return {
        schema: {
            ...base,
            type: base.type ?? canonico.type ?? "object",
            properties: { ...propsVivo, ...Object.fromEntries(nuevas.map((k) => [k, propsCanon[k]])) },
        },
        nuevas,
    };
}

/**
 * Trae cada fila viva del registro a su copy canónico. Recibe el `PrismaClient` (no una
 * transacción compartida): cada fila se lee y se escribe sola, con su error atrapado, para que
 * una fila envenenada no tumbe a las sanas.
 */
export async function corregirCorreosCanonicos(
    db: PrismaClient,
    opts: { dryRun: boolean }
): Promise<ResultadoCorrectorCopys> {
    const desactualizadas: FilaCopyCambio[] = [];
    const clavesSinFila: string[] = [];
    const fallidas: FilaCopyFallida[] = [];
    let encontradas = 0;
    let corregidas = 0;

    for (const c of CORREOS_CANONICOS) {
        const asunto = c.asunto ?? null; // IN_APP: sin asunto
        let fila: FilaLeida | null;
        try {
            fila = await db.notificacionPlantilla.findUnique({ where: { clave: c.clave } });
        } catch (e) {
            fallidas.push({ clave: c.clave, error: e instanceof Error ? e.message : String(e) });
            continue;
        }
        if (!fila) {
            clavesSinFila.push(c.clave);
            continue;
        }
        encontradas++;
        const campos: FilaCopyCambio["campos"] = [];
        if ((fila.asunto ?? null) !== asunto) campos.push("asunto");
        if (fila.cuerpoMarkdown !== c.cuerpoMarkdown) campos.push("cuerpo");
        const merge = mergeSchemaAditivo(fila.variablesSchema, c.variablesSchema);
        if (merge.nuevas.length > 0) campos.push("schema");
        if (campos.length === 0) continue; // idempotente
        desactualizadas.push({
            clave: c.clave,
            id: fila.id,
            campos,
            variablesNuevas: merge.nuevas,
            version: fila.version,
            editadaEnPanel: fila.actualizadaPor != null,
        });
        if (opts.dryRun) continue;
        try {
            await db.notificacionPlantilla.update({
                where: { clave: c.clave },
                // activa, canal y version se PRESERVAN; el schema solo GANA claves (merge aditivo).
                data: {
                    asunto,
                    cuerpoMarkdown: c.cuerpoMarkdown,
                    ...(merge.nuevas.length > 0 ? { variablesSchema: merge.schema as Prisma.InputJsonValue } : {}),
                },
            });
            corregidas++;
        } catch (e) {
            fallidas.push({ clave: c.clave, error: e instanceof Error ? e.message : String(e) });
        }
    }

    return { encontradas, desactualizadas, clavesSinFila, corregidas, fallidas, escrito: corregidas > 0 };
}

/** Corre el modo pedido: SOLO `confirm` escribe; `dry-run` y `aviso` son de solo lectura. */
export function correrModo(db: PrismaClient, modo: ModoCorrector): Promise<ResultadoCorrectorCopys> {
    return corregirCorreosCanonicos(db, { dryRun: modo !== "confirm" });
}

/** La línea del detector de deriva (`--aviso`, final del deploy). */
export function lineaDeAviso(r: ResultadoCorrectorCopys): string {
    const n = r.desactualizadas.length;
    const partes: string[] = [];
    if (n > 0) {
        partes.push(
            `⚠️  ${n} ${n === 1 ? "plantilla difiere" : "plantillas difieren"} del canónico → corré el corrector ` +
                "(scripts/corregir-correos-canonicos.ts: DRY-RUN y, si corresponde, --confirm)"
        );
    } else {
        partes.push(`✓ 0 plantillas difieren del canónico (${r.encontradas} vivas del registro)`);
    }
    if (r.fallidas.length > 0) partes.push(`⚠️  ${r.fallidas.length} no se pudieron verificar`);
    return partes.join(" · ");
}

/** El detalle de una fila desactualizada (para el DRY-RUN y el aviso). */
export function detalleDeFila(f: FilaCopyCambio): string {
    const panel = f.editadaEnPanel ? " · EDITADA EN PANEL (--confirm revierte esa edición)" : "";
    const copy = f.campos.filter((x) => x !== "schema");
    const partes = [
        ...(copy.length > 0 ? [`difiere: ${copy.join(" + ")}`] : []),
        ...(f.variablesNuevas.length > 0 ? [`schema +${f.variablesNuevas.length} (${f.variablesNuevas.join(", ")})`] : []),
    ];
    return `  ${f.clave} — ${partes.join(" · ")} · v${f.version}${panel}`;
}

async function main(): Promise<void> {
    const { modo } = parsearArgsCorrector(process.argv);
    const r = await correrModo(prisma, modo);

    if (modo === "aviso") {
        console.log(`${TAG} ${lineaDeAviso(r)}`);
        for (const f of r.desactualizadas) console.log(detalleDeFila(f));
        for (const f of r.fallidas) console.log(`  ✗ ${f.clave}: ${f.error}`);
        // Guardián blando de COBERTURA contra la tabla viva (lo que CI, con seed fresco, no ve).
        const huecos = await escanearCoberturaViva(prisma).catch((e) => [`no se pudo escanear cobertura: ${e instanceof Error ? e.message : String(e)}`]);
        if (huecos.length > 0) {
            console.log(`${TAG} ⚠️  cobertura: ${huecos.length} clave(s) viva(s) fuera de registro ∪ pendientes ∪ huérfanas → declarar en pendientes/huérfanas:`);
            for (const h of huecos) console.log(`    ${h}`);
        } else {
            console.log(`${TAG} ✓ cobertura: toda clave viva está declarada (registro ∪ pendientes ∪ huérfanas)`);
        }
        if (r.fallidas.length > 0) process.exitCode = 1;
        return;
    }

    console.log(`${TAG} modo: ${modo === "confirm" ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`);
    console.log(
        `${TAG} registro: ${CORREOS_CANONICOS.length} copys · filas vivas: ${r.encontradas} · desactualizadas (≠ canónico): ${r.desactualizadas.length}`
    );
    for (const f of r.desactualizadas) console.log(detalleDeFila(f));
    if (r.clavesSinFila.length > 0) {
        console.warn(`${TAG} claves SIN fila viva (las crea el seed): ${r.clavesSinFila.join(", ")}`);
    }
    if (r.fallidas.length > 0) {
        console.error(`${TAG} ${r.fallidas.length} fila(s) NO se pudieron leer/corregir:`);
        for (const f of r.fallidas) console.error(`  ✗ ${f.clave}: ${f.error}`);
        process.exitCode = 1;
    }
    if (modo === "confirm") {
        console.log(`${TAG} corregidas: ${r.corregidas}/${r.desactualizadas.length}`);
        if (r.fallidas.length === 0) console.log(`${TAG} Listo. El candado exige el copy del registro.`);
    } else {
        console.log(`${TAG} DRY-RUN: no se escribió nada. Corré con --confirm para aplicar.`);
    }
}

if (
    process.argv[1]?.endsWith("corregir-correos-canonicos.ts") ||
    process.argv[1]?.endsWith("corregir-correos-canonicos.js")
) {
    main()
        .catch((e) => {
            console.error(e instanceof Error ? e.message : e);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
