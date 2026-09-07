/**
 * SPEC-581 · Backfill ADITIVO de `ContenidoReporte` + `LlaveReporte`.
 *
 * Migra las filas EXISTENTES de las columnas viejas (`Reporte.texto`/`textoOriginal`,
 * `EventoExpediente.texto` — INTACTAS en la base, ya fuera del modelo de Prisma) hacia la
 * capa DEK-por-denuncia de S-C. Descifra el `enc:` viejo con `PARAM_ENCRYPTION_KEY`
 * (`param-encryption.ts`) y re-cifra con `sellarTextoNuevo` (DEK por fila, envuelta por la KEK
 * `REPORTE_TEXTO_KEY_V<n>`).
 *
 * Reglas por fila:
 * - texto == marcador D4 ("[contenido purgado]") → se sella el marcador, `origenEvidencia =
 *   PURGADA` y `purgadoEn` = momento del backfill (la fila vieja no guardaba fecha de purga).
 * - texto `enc:{…}` → se descifra; si NO descifra, la fila se SALTA, se contabiliza como fallo
 *   y el script termina con código 1 (la fila queda para análisis; las demás sí migran).
 * - texto plano legado (previo a BL-4) → se sella tal cual.
 * - `textoOriginal` NULL (nunca anonimizado) → la evidencia ES el texto de trabajo.
 *
 * Idempotente: salta las filas que ya tienen `contenidoId`. DRY-RUN por defecto (solo cuenta);
 * `--confirm` aplica en lotes dentro de transacciones. Re-ejecutable: las filas ya migradas se
 * saltan en corridas siguientes.
 *
 * Uso: node --import tsx scripts/backfill-contenido-reporte.ts [--confirm] [--lote=200]
 */
import { OrigenEvidencia } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { decryptParameter, isEncryptedValue } from "../src/lib/param-encryption";
import { sellarTextoNuevo } from "../src/lib/reporte-texto-contenido";
import { parseArgs } from "./limpieza/_common";

const MARCADOR_D4 = "[contenido purgado]";

const args = parseArgs(process.argv, ["confirm", "lote"]);
const CONFIRM = args.confirm === true;
const LOTE = (() => {
    const raw = typeof args.lote === "string" ? Number.parseInt(args.lote, 10) : 200;
    if (!Number.isFinite(raw) || raw < 1 || raw > 2000) {
        throw new Error(`[backfill] --lote inválido: ${String(args.lote)} (1..2000)`);
    }
    return raw;
})();

interface FilaReporte {
    id: string;
    texto: string | null;
    textoOriginal: string | null;
}

interface FilaEvento {
    id: string;
    texto: string | null;
}

/** Descifra un valor viejo replicando la semántica del layer legado: marcador → tal cual; `enc:` → descifra (LANZA si la llave no calza); plano legado → tal cual. */
function descifrarViejo(valor: string | null): { plano: string; purgado: boolean } | null {
    if (valor === null) return null;
    if (valor === "" || valor === MARCADOR_D4) return { plano: valor, purgado: valor === MARCADOR_D4 };
    if (isEncryptedValue(valor)) return { plano: decryptParameter(valor), purgado: false };
    return { plano: valor, purgado: false };
}

async function main() {
    console.log(`[backfill] modo: ${CONFIRM ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"} · lote=${LOTE}`);

    const reportesPendientes = await prisma.$queryRaw<FilaReporte[]>`
        SELECT id, texto, "textoOriginal" FROM "Reporte" WHERE "contenidoId" IS NULL
    `;
    const eventosPendientes = await prisma.$queryRaw<FilaEvento[]>`
        SELECT id, texto FROM "EventoExpediente" WHERE "contenidoId" IS NULL
    `;
    console.log(`[backfill] pendientes: ${reportesPendientes.length} reportes, ${eventosPendientes.length} eventos`);

    let migrados = 0;
    let saltados = 0;
    const fallos: { tabla: string; id: string; error: string }[] = [];

    // ---- Reportes ----
    for (let i = 0; i < reportesPendientes.length; i += LOTE) {
        const lote = reportesPendientes.slice(i, i + LOTE);
        for (const fila of lote) {
            try {
                const trabajo = descifrarViejo(fila.texto);
                if (!trabajo) {
                    fallos.push({ tabla: "Reporte", id: fila.id, error: "texto NULL" });
                    continue;
                }
                const evidencia = descifrarViejo(fila.textoOriginal) ?? trabajo;
                if (CONFIRM) {
                    await prisma.$transaction(async (tx) => {
                        const { contenidoId } = await sellarTextoNuevo(tx, {
                            texto: trabajo.plano,
                            textoOriginal: evidencia.plano,
                            origenEvidencia: trabajo.purgado || evidencia.purgado ? OrigenEvidencia.PURGADA : OrigenEvidencia.ORIGINAL,
                        });
                        if (trabajo.purgado || evidencia.purgado) {
                            await tx.contenidoReporte.update({
                                where: { id: contenidoId },
                                data: { purgadoEn: new Date() },
                            });
                        }
                        // WHERE "contenidoId" IS NULL: si otra corrida ya lo migró, no pisa.
                        const res = await tx.$executeRaw`
                            UPDATE "Reporte" SET "contenidoId" = ${contenidoId} WHERE id = ${fila.id} AND "contenidoId" IS NULL
                        `;
                        if (res === 0) {
                            // Ya tenía contenido (corrida concurrente): quema el recién creado.
                            await tx.contenidoReporte.delete({ where: { id: contenidoId } });
                            saltados++;
                            return;
                        }
                        migrados++;
                    });
                } else {
                    migrados++;
                }
            } catch (error) {
                fallos.push({ tabla: "Reporte", id: fila.id, error: error instanceof Error ? error.message : String(error) });
            }
        }
        if (CONFIRM) console.log(`[backfill] reportes ${Math.min(i + LOTE, reportesPendientes.length)}/${reportesPendientes.length}`);
    }

    // ---- Eventos de expediente ----
    for (let i = 0; i < eventosPendientes.length; i += LOTE) {
        const lote = eventosPendientes.slice(i, i + LOTE);
        for (const fila of lote) {
            try {
                const trabajo = descifrarViejo(fila.texto);
                if (!trabajo) {
                    fallos.push({ tabla: "EventoExpediente", id: fila.id, error: "texto NULL" });
                    continue;
                }
                if (CONFIRM) {
                    await prisma.$transaction(async (tx) => {
                        const { contenidoId } = await sellarTextoNuevo(tx, {
                            texto: trabajo.plano,
                            textoOriginal: trabajo.plano,
                            origenEvidencia: trabajo.purgado ? OrigenEvidencia.PURGADA : OrigenEvidencia.ORIGINAL,
                        });
                        if (trabajo.purgado) {
                            await tx.contenidoReporte.update({
                                where: { id: contenidoId },
                                data: { purgadoEn: new Date() },
                            });
                        }
                        const res = await tx.$executeRaw`
                            UPDATE "EventoExpediente" SET "contenidoId" = ${contenidoId} WHERE id = ${fila.id} AND "contenidoId" IS NULL
                        `;
                        if (res === 0) {
                            await tx.contenidoReporte.delete({ where: { id: contenidoId } });
                            saltados++;
                            return;
                        }
                        migrados++;
                    });
                } else {
                    migrados++;
                }
            } catch (error) {
                fallos.push({ tabla: "EventoExpediente", id: fila.id, error: error instanceof Error ? error.message : String(error) });
            }
        }
        if (CONFIRM) console.log(`[backfill] eventos ${Math.min(i + LOTE, eventosPendientes.length)}/${eventosPendientes.length}`);
    }

    console.log(`[backfill] listo: ${migrados} migrados, ${saltados} ya migrados (concurrente), ${fallos.length} fallos`);
    for (const f of fallos) {
        // NUNCA loguear el contenido del texto — solo el id y el error.
        console.error(`[backfill] FALLO ${f.tabla} ${f.id}: ${f.error}`);
    }
    await prisma.$disconnect();
    process.exit(fallos.length > 0 ? 1 : 0);
}

main().catch(async (error) => {
    console.error("[backfill] error fatal:", error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
});
