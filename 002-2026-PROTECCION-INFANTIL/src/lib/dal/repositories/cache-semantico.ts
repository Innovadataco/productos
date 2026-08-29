/**
 * SPEC-195 (002-PI-089): repositorio del caché semántico humano.
 * Las queries raw de pgvector viven aquí; `src/lib/ai/cache-semantico.ts`
 * conserva la interfaz pública y delega.
 */
import type { CategoriaConducta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { aJson } from "@/lib/dal/json";
import type { ClasificacionResult } from "@/lib/dal/services/reporte-processing/clasificacion";
import type { DbClient } from "../unit-of-work";

export interface CacheSemanticoHit {
    hit: true;
    reporteOrigenId: string;
    categoria: CategoriaConducta;
    confianza: number;
    similitud: number;
}

export interface CacheSemanticoMiss {
    hit: false;
}

export type CacheSemanticoResult = CacheSemanticoHit | CacheSemanticoMiss;

export interface OpcionesCacheSemantico {
    reporteIdActual: string;
    modeloEmbedding: string;
    similitudUmbral: number;
    soloHumanoConfirmado: boolean;
}

export class CacheSemanticoRepository {
    constructor(private readonly db: DbClient = prisma) {}

    /**
     * Busca un reporte previo con embedding similar (>= umbral) cuya clasificación haya
     * sido confirmada o corregida por un humano. Si `soloHumanoConfirmado` es true, solo
     * acepta reportes en estado `CORREGIDO` con `CorreccionAdmin.confirmada = true`.
     * Si es false, también acepta `CLASIFICADO` con confianza >= 0.9.
     */
    async buscarClasificacionCache(
        embedding: number[],
        opciones: OpcionesCacheSemantico
    ): Promise<CacheSemanticoResult> {
        const vectorStr = "[" + embedding.join(",") + "]";
        const aceptarClasificadoAuto = !opciones.soloHumanoConfirmado;

        const rows = await this.db.$queryRaw<
            { reporteId: string; categoria: CategoriaConducta; confianza: number; similitud: number }[]
        >`
            SELECT e."reporteId", c.categoria, c.confianza, 1 - (e.vector <=> ${vectorStr}::vector) AS similitud
            FROM "EmbeddingReporte" e
            JOIN "Reporte" r ON r.id = e."reporteId"
            LEFT JOIN "ClasificacionIA" c ON c."reporteId" = r.id
            LEFT JOIN "CorreccionAdmin" ca ON ca."clasificacionId" = c.id
            WHERE e."reporteId" != ${opciones.reporteIdActual}
              AND r.eliminado = false
              AND e."modeloUsado" = ${opciones.modeloEmbedding}
              AND 1 - (e.vector <=> ${vectorStr}::vector) >= ${opciones.similitudUmbral}
              AND (
                  (r.estado = 'CORREGIDO' AND ca.confirmada = true)
                  OR (${aceptarClasificadoAuto} AND r.estado = 'CLASIFICADO' AND c.confianza >= 0.9)
              )
            ORDER BY e.vector <=> ${vectorStr}::vector ASC
            LIMIT 1
        `;

        const row = rows[0];
        if (!row) return { hit: false };

        return {
            hit: true,
            reporteOrigenId: row.reporteId,
            categoria: row.categoria,
            confianza: row.confianza,
            similitud: row.similitud,
        };
    }

    /**
     * Persiste una clasificación heredada por caché humano y devuelve el resultado
     * en la forma que espera el resto del pipeline.
     */
    async persistirClasificacionCache(
        reporteId: string,
        hit: CacheSemanticoHit
    ): Promise<ClasificacionResult> {
        const modeloUsado = `cache:humano:${hit.reporteOrigenId}`;
        const rawResponse = {
            cache: true,
            reporteOrigenId: hit.reporteOrigenId,
            similitud: hit.similitud,
            categoria: hit.categoria,
            confianza: hit.confianza,
        };

        await this.db.clasificacionIA.create({
            data: {
                reporteId,
                categoria: hit.categoria,
                confianza: hit.confianza,
                contienePii: false,
                piiDetectada: [],
                categoriasSecundarias: aJson([]),
                votos: aJson([]),
                posibleAgresorPar: false,
                modeloUsado,
                latenciaMs: 0,
                rawResponse: JSON.stringify(rawResponse),
            },
        });

        return {
            categoria: hit.categoria,
            confianza: hit.confianza,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "CLASIFICADO",
            metrics: { modelo: modeloUsado, latenciaMs: 0 },
            rawResponse,
            votos: [],
        };
    }
}
