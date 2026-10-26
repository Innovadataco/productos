/**
 * SPEC-908 · Corrector de VOZ de las 8 Guías de Acción: voseo → tú (tuteo), IN-PLACE.
 *
 * Por qué hace falta (y el seed no basta): el seed de guías es create-if-not-exists
 * (`findFirst` por categoría → si existe, la respeta). Las filas VIVAS que sobreviven
 * a un reset de datos conservan el voseo viejo; el re-seed NO las pisa. Este corrector
 * trae esas filas al copy tú canónico (`GUIAS_ACCION_BASE`, la MISMA fuente del seed y
 * del candado de voz) — una sola fuente, sin derivar.
 *
 * Es un fix de VOZ, no de contenido: actualiza SOLO los campos que portan la voz
 * (tituloEmocional, subtitulo, pasosJson, calloutTitulo, calloutTexto) y PRESERVA
 * versionSecuencial, estado, aprobadaPorComiteJson, creadaPorAdminId y los campos no
 * verbales (categoriaBadgeTexto, botonesAccionJson, piePagina). No requiere re-aprobación
 * de comité (decisión CEO · SPEC-908).
 *
 * DRY-RUN por defecto (solo lee e imprime el diff); `--confirm` aplica FILA POR FILA
 * (una que reviente NO aborta a las demás; lección del lote atómico). Idempotente: una
 * fila ya en tú no se re-escribe (se compara contra el canónico), así que la 2ª corrida
 * reporta 0 cambios. ABORTA ante un flag desconocido. exit≠0 si alguna fila falla.
 *
 * Uso: node --import tsx scripts/corregir-guias-accion-voz-tu.ts [--confirm]
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { parseArgs } from "./limpieza/_common";
import { GUIAS_ACCION_BASE } from "../prisma/guias-accion.seed-data";

/** Campos de VOZ que el corrector actualiza. El resto de la fila se preserva. */
interface CamposVoz {
    tituloEmocional: string;
    subtitulo: string;
    pasosJson: unknown;
    calloutTitulo: string;
    calloutTexto: string;
}

export interface FilaGuiaCambio {
    categoria: string;
    id: string;
    versionSecuencial: number;
    estado: string;
}

export interface FilaGuiaFallida {
    categoria: string;
    id: string;
    error: string;
}

export interface ResultadoCorrectorGuias {
    /** Filas vivas encontradas (una o más por categoría). */
    encontradas: number;
    /** Filas cuya voz DIFIERE del canónico tú (candidatas a corregir). */
    conVoseo: FilaGuiaCambio[];
    /** Categorías del catálogo sin ninguna fila viva (nada que corregir). */
    categoriasSinFila: string[];
    corregidas: number;
    fallidas: FilaGuiaFallida[];
    escrito: boolean;
}

/** Normaliza para comparar: la fila ya está en tú si TODOS los campos de voz coinciden. */
function yaEnTu(fila: { tituloEmocional: string; subtitulo: string | null; pasosJson: unknown; calloutTitulo: string | null; calloutTexto: string | null }, canon: CamposVoz): boolean {
    return (
        fila.tituloEmocional === canon.tituloEmocional &&
        (fila.subtitulo ?? "") === canon.subtitulo &&
        (fila.calloutTitulo ?? "") === canon.calloutTitulo &&
        (fila.calloutTexto ?? "") === canon.calloutTexto &&
        JSON.stringify(fila.pasosJson) === JSON.stringify(canon.pasosJson)
    );
}

/**
 * Trae las filas vivas de las 8 guías al copy tú canónico, campo de voz por campo de voz.
 * Recibe el `PrismaClient` (no una transacción compartida): cada fila se escribe sola, con
 * su error atrapado, para que una fila envenenada no tumbe a las sanas.
 */
export async function corregirGuiasAccionVozTu(
    db: PrismaClient,
    opts: { dryRun: boolean },
): Promise<ResultadoCorrectorGuias> {
    const conVoseo: FilaGuiaCambio[] = [];
    const categoriasSinFila: string[] = [];
    const fallidas: FilaGuiaFallida[] = [];
    let encontradas = 0;
    let corregidas = 0;

    for (const guia of GUIAS_ACCION_BASE) {
        const canon: CamposVoz = {
            tituloEmocional: guia.tituloEmocional,
            subtitulo: guia.subtitulo,
            pasosJson: guia.pasos,
            calloutTitulo: guia.calloutTitulo,
            calloutTexto: guia.calloutTexto,
        };
        const filas = await db.guiaAccionCategoria.findMany({
            where: { categoria: guia.categoria },
            orderBy: { versionSecuencial: "asc" },
        });
        if (filas.length === 0) {
            categoriasSinFila.push(guia.categoria);
            continue;
        }
        for (const fila of filas) {
            encontradas++;
            if (yaEnTu(fila, canon)) continue; // idempotente: ya está en tú.
            conVoseo.push({ categoria: guia.categoria, id: fila.id, versionSecuencial: fila.versionSecuencial, estado: String(fila.estado) });
            if (opts.dryRun) continue;
            try {
                await db.guiaAccionCategoria.update({
                    where: { id: fila.id },
                    data: {
                        tituloEmocional: canon.tituloEmocional,
                        subtitulo: canon.subtitulo,
                        pasosJson: canon.pasosJson as object,
                        calloutTitulo: canon.calloutTitulo,
                        calloutTexto: canon.calloutTexto,
                        // versionSecuencial, estado, aprobadaPorComiteJson, categoriaBadgeTexto,
                        // botonesAccionJson y piePagina se PRESERVAN (fix de voz, no de contenido).
                    },
                });
                corregidas++;
            } catch (e) {
                fallidas.push({ categoria: guia.categoria, id: fila.id, error: e instanceof Error ? e.message : String(e) });
            }
        }
    }

    return { encontradas, conVoseo, categoriasSinFila, corregidas, fallidas, escrito: corregidas > 0 };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    const confirm = args.confirm === true;
    console.log(
        `[corregir-guias-voz] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`,
    );
    const r = await corregirGuiasAccionVozTu(prisma, { dryRun: !confirm });
    console.log(`[corregir-guias-voz] filas vivas encontradas: ${r.encontradas} · con voz distinta al canónico tú: ${r.conVoseo.length}`);
    for (const f of r.conVoseo) {
        console.log(`  ${f.categoria} (v${f.versionSecuencial}, ${f.estado}, ${f.id})  →  tú`);
    }
    if (r.categoriasSinFila.length > 0) {
        console.warn(`[corregir-guias-voz] categorías del catálogo SIN fila viva: ${r.categoriasSinFila.join(", ")}`);
    }
    if (confirm) {
        console.log(`[corregir-guias-voz] corregidas: ${r.corregidas}/${r.conVoseo.length}`);
        if (r.fallidas.length > 0) {
            console.error(`[corregir-guias-voz] ${r.fallidas.length} fila(s) NO se pudieron corregir:`);
            for (const f of r.fallidas) console.error(`  ✗ ${f.categoria} (${f.id}): ${f.error}`);
            process.exitCode = 1;
        } else {
            console.log("[corregir-guias-voz] Listo. El candado de voz exige que el contenido canónico quede sin voseo.");
        }
    } else {
        console.log("[corregir-guias-voz] DRY-RUN: no se escribió nada. Corré con --confirm para aplicar.");
    }
}

if (
    process.argv[1]?.endsWith("corregir-guias-accion-voz-tu.ts") ||
    process.argv[1]?.endsWith("corregir-guias-accion-voz-tu.js")
) {
    main()
        .catch((e) => {
            console.error(e instanceof Error ? e.message : e);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
