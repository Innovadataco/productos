/**
 * Búsqueda híbrida FTS + vectorial fusionada con RRF (spec 003, US4, D-019).
 *
 * Sustituye la puntuación en memoria de Node (`text.includes`, FR-015b): todo el
 * ranking se resuelve en PostgreSQL. Dos ramas, cada una con sus filtros de
 * metadatos aplicados **antes** (FR-014) y excluyendo inactivos (SC-015):
 *   - FTS: `contenidoFts @@ plainto_tsquery('spanish', f_unaccent($q))` (FR-027).
 *   - vectorial: `embedding <=> $vec` (coseno), solo chunks del **modelo +
 *     enriquecimiento vigentes** (FR-021b), sobre el índice HNSW.
 * Se fusionan con RRF (pesos y topK configurables, FR-024) y se colapsa a un
 * documento por fila (FR-014).
 *
 * Degradación útil (US4-4): si no hay embedding de consulta (Ollama caído o sin
 * modelo), la rama FTS responde sola en vez de fallar con error opaco.
 *
 * Las consultas van por `$queryRaw` parametrizado (FR-012). El cliente de Prisma
 * y el embedding de la consulta se inyectan para poder probar la orquestación
 * (fusión, dedup, filtros, degradación) con mocks, sin BD ni Ollama.
 */

import { Prisma } from "@prisma/client";
import { construirFiltros, type FiltrosBusqueda } from "./filtros";
import { fusionarRRF, type EntradaRanking } from "./rrf";
import type { ParametrosRag } from "@/lib/ragConfig";

/** Subconjunto del cliente Prisma que usa la búsqueda (el mock se pasa `as never`). */
type PrismaBusqueda = Pick<import("@prisma/client").PrismaClient, "$queryRaw" | "documentoOficial">;

export interface OpcionesBusqueda {
  query: string;
  filtros: FiltrosBusqueda;
  parametros: ParametrosRag;
  /** Modelo + enriquecimiento vigentes: la rama vectorial filtra por ambos (FR-021b). */
  embeddingModel: string;
  enrichConfig: string;
  /** Embedding de la consulta; null → solo FTS (degradación útil, US4-4). */
  queryEmbedding: number[] | null;
  /** Límite de candidatos por rama antes de fusionar (topK sale de config). */
}

export interface ResultadoBusqueda extends Record<string, unknown> {
  score: number;
  fuente: string;
}

/** Fila de ranking que devuelve cada rama. */
interface FilaRanking {
  documentoId: string;
}

function aRanking(filas: FilaRanking[]): EntradaRanking[] {
  return filas.map((f, posicion) => ({ documentoId: f.documentoId, posicion }));
}

export async function buscarHibrida(
  prisma: PrismaBusqueda,
  opciones: OpcionesBusqueda,
): Promise<ResultadoBusqueda[]> {
  const { query, filtros, parametros, embeddingModel, enrichConfig, queryEmbedding } = opciones;
  const filtroSql = construirFiltros(filtros);
  const limitePorRama = Math.max(parametros.topK * 4, parametros.topK);

  // Rama FTS: sobre el contenido plano indexado (FR-027), agrupada por documento.
  const ftsFilas = await prisma.$queryRaw<FilaRanking[]>(Prisma.sql`
    SELECT c."documentoId"
    FROM "DocumentoChunk" c
    JOIN "DocumentoOficial" d ON d."id" = c."documentoId"
    WHERE ${filtroSql}
      AND c."contenidoFts" @@ plainto_tsquery('spanish', f_unaccent(${query}))
    GROUP BY c."documentoId"
    ORDER BY MAX(ts_rank(c."contenidoFts", plainto_tsquery('spanish', f_unaccent(${query})))) DESC
    LIMIT ${limitePorRama}
  `);

  // Rama vectorial: solo si hay embedding de consulta (degradación útil si no).
  let vecFilas: FilaRanking[] = [];
  if (queryEmbedding && queryEmbedding.length > 0) {
    const vecLiteral = `[${queryEmbedding.join(",")}]`;
    vecFilas = await prisma.$queryRaw<FilaRanking[]>(Prisma.sql`
      SELECT c."documentoId"
      FROM "DocumentoChunk" c
      JOIN "DocumentoOficial" d ON d."id" = c."documentoId"
      WHERE ${filtroSql}
        AND c."embeddingModel" = ${embeddingModel}
        AND c."enrichConfig" = ${enrichConfig}
      GROUP BY c."documentoId"
      ORDER BY MIN(c."embedding" <=> ${vecLiteral}::vector) ASC
      LIMIT ${limitePorRama}
    `);
  }

  const fusionados = fusionarRRF(aRanking(ftsFilas), aRanking(vecFilas), {
    pesoFts: parametros.pesoFts,
    pesoVectorial: parametros.pesoVectorial,
    rrfK: parametros.rrfK,
    topK: parametros.topK,
  });

  if (fusionados.length === 0) return [];

  // Hidrata los documentos (una sola vez cada uno, FR-014) preservando el orden RRF.
  const ids = fusionados.map((f) => f.documentoId);
  const docs = await prisma.documentoOficial.findMany({ where: { id: { in: ids } } });
  const porId = new Map(docs.map((d) => [d.id as string, d]));

  return fusionados
    .map((f) => {
      const doc = porId.get(f.documentoId);
      if (!doc) return null;
      return { ...doc, score: f.score, fuente: f.fuente } as ResultadoBusqueda;
    })
    .filter((x): x is ResultadoBusqueda => x !== null);
}
