/**
 * Núcleo del backfill de embeddings (spec 003, US5, FR-016).
 *
 * Vectoriza los documentos con texto que **no** tienen fragmentos del modelo +
 * enriquecimiento vigentes. Idempotente y reanudable (SC-006/SC-007): una
 * segunda pasada no cambia el total porque solo procesa los pendientes.
 *
 * Cuenta como **pendientes de re-vectorizar** los documentos activos con texto
 * cuyos chunks no coinciden en modelo O en enriquecimiento con los vigentes
 * (FR-021c): las dos causas, no solo el cambio de modelo.
 *
 * El cliente de embeddings y `vectorizarDocumento` se inyectan para poder probar
 * la orquestación sin BD ni Ollama. La **ejecución real** es trabajo pesado
 * (TP-3): no corre sin turno.
 */

import type { EmbedFn } from "@/lib/ingestChunks";
import type { DocumentoParaVectorizar, ResultadoVectorizacion } from "@/lib/ingestChunks";
import type { ModeloEmbeddingsResuelto } from "@/lib/ragConfig";

interface PrismaBackfill {
  $queryRaw: <T = unknown>(query: import("@prisma/client").Prisma.Sql) => Promise<T>;
}

/** Vectorizador inyectable (en producción, `vectorizarDocumento`). */
export type VectorizarFn = (doc: DocumentoParaVectorizar) => Promise<ResultadoVectorizacion>;

export interface ProgresoBackfill {
  procesados: number;
  omitidos: number;
  fallidos: number;
  fragmentos: number;
}

/** Documento pendiente que devuelve la consulta de selección. */
export interface DocPendiente {
  id: string;
  contenidoTexto: string;
  tipo: string | null;
  numero: string | null;
  entidad: string | null;
  fecha: string | null;
}

/**
 * Cuenta los documentos pendientes de re-vectorizar para el modelo +
 * enriquecimiento vigentes (FR-021c, SC-017). Un documento cuenta si está
 * activo, tiene texto y NO tiene ningún chunk que coincida en ambos.
 */
export async function contarPendientes(
  prisma: PrismaBackfill,
  modelo: Pick<ModeloEmbeddingsResuelto, "modelPath" | "enrichConfigHuella">,
): Promise<number> {
  const { Prisma } = await import("@prisma/client");
  const filas = await prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS n
    FROM "DocumentoOficial" d
    WHERE d."activo" = true
      AND length(trim(d."contenidoTexto")) > 0
      AND NOT EXISTS (
        SELECT 1 FROM "DocumentoChunk" c
        WHERE c."documentoId" = d."id"
          AND c."embeddingModel" = ${modelo.modelPath}
          AND c."enrichConfig" = ${modelo.enrichConfigHuella}
      )
  `);
  return Number(filas[0]?.n ?? 0);
}

/**
 * Recorre los documentos pendientes y los vectoriza. Reanudable: como
 * `vectorizarDocumento` deja los chunks del modelo vigente, una segunda pasada
 * ya no los selecciona. `onProgreso` recibe el avance tras cada documento.
 */
export async function ejecutarBackfill(
  prisma: PrismaBackfill,
  modelo: Pick<ModeloEmbeddingsResuelto, "modelPath" | "enrichConfigHuella">,
  vectorizar: VectorizarFn,
  onProgreso?: (p: ProgresoBackfill) => void,
): Promise<ProgresoBackfill> {
  const { Prisma } = await import("@prisma/client");
  const pendientes = await prisma.$queryRaw<DocPendiente[]>(Prisma.sql`
    SELECT d."id",
           d."contenidoTexto",
           d."tipo",
           d."numero",
           d."entidad",
           to_char(d."fechaExpedicion", 'YYYY-MM-DD') AS "fecha"
    FROM "DocumentoOficial" d
    WHERE d."activo" = true
      AND length(trim(d."contenidoTexto")) > 0
      AND NOT EXISTS (
        SELECT 1 FROM "DocumentoChunk" c
        WHERE c."documentoId" = d."id"
          AND c."embeddingModel" = ${modelo.modelPath}
          AND c."enrichConfig" = ${modelo.enrichConfigHuella}
      )
    ORDER BY d."createdAt" ASC
  `);

  const progreso: ProgresoBackfill = { procesados: 0, omitidos: 0, fallidos: 0, fragmentos: 0 };

  for (const doc of pendientes) {
    try {
      const res = await vectorizar({
        id: doc.id,
        contenidoTexto: doc.contenidoTexto,
        tipo: doc.tipo,
        numero: doc.numero,
        entidad: doc.entidad,
        fecha: doc.fecha,
      });
      if (res.sinContenido) progreso.omitidos += 1;
      else {
        progreso.procesados += 1;
        progreso.fragmentos += res.chunksCreados;
      }
    } catch {
      // Un documento que falla no detiene el backfill; se reintenta en la próxima
      // pasada (sigue siendo pendiente). El motivo va al log del que ejecuta.
      progreso.fallidos += 1;
    }
    onProgreso?.({ ...progreso });
  }

  return progreso;
}

// Los tipos EmbedFn se re-exportan por conveniencia de quien arma el vectorizador.
export type { EmbedFn };
