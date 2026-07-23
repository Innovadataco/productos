/**
 * Vectorización de un documento como parte de la ingesta (spec 003, US3).
 *
 * Trocea → enriquece (solo para vectorizar, FR-026) → embebe cada fragmento →
 * reemplaza de forma consistente los fragmentos del documento. Idempotente
 * (FR-009): reprocesar deja el mismo número de fragmentos, no duplica.
 *
 * El cliente de embeddings se **inyecta** (`embed`) para que el worker pase el
 * real y las pruebas pasen un mock: nada de red en la suite (FR-017). La
 * inserción del vector va por SQL parametrizado (`$executeRaw`) porque Prisma no
 * tipa `vector` (FR-012); nunca por concatenación de strings.
 *
 * `embeddingModel` y `enrichConfig` se guardan por fragmento: definen a qué
 * espacio vectorial pertenece (FR-021/FR-026), y la búsqueda filtra por ambos.
 */

import { randomUUID } from "crypto";
import { trocear } from "@/lib/chunker";
import { construirPrefijo, textoParaVectorizar, type MetadatosDocumento } from "@/lib/enrich";
import { EMBEDDING_DIMS, type EmbedResult } from "@/lib/modelClients";
import type { ModeloEmbeddingsResuelto } from "@/lib/ragConfig";

/** Documento mínimo que necesita la vectorización. */
export interface DocumentoParaVectorizar extends MetadatosDocumento {
  id: string;
  contenidoTexto: string;
}

/** Función de embedding inyectable (el worker pasa `embedText`; los tests, un mock). */
export type EmbedFn = (texto: string) => Promise<EmbedResult>;

/** Prisma mínimo que usa la vectorización (facilita el mock). */
interface PrismaIngest {
  documentoChunk: { deleteMany: (args: unknown) => Promise<unknown> };
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
  $transaction: <T>(fn: (tx: PrismaIngest) => Promise<T>) => Promise<T>;
}

export interface ResultadoVectorizacion {
  chunksCreados: number;
  /** true si no había texto que vectorizar: NO es un error (US3-5). */
  sinContenido: boolean;
}

/** Serializa un vector JS al literal que entiende pgvector: `[0.1,0.2,...]`. */
function aLiteralVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Vectoriza el documento y reemplaza sus fragmentos. Lanza si un embedding falla
 * (el worker lo captura, reintenta y, agotados los reintentos, deja el documento
 * en `needs_review` sin perder texto — FR-010). Un documento sin texto se
 * completa sin fragmentos y sin error (US3-5).
 */
export async function vectorizarDocumento(
  prisma: PrismaIngest,
  doc: DocumentoParaVectorizar,
  modelo: ModeloEmbeddingsResuelto,
  embed: EmbedFn,
): Promise<ResultadoVectorizacion> {
  const { parametros, enrichConfigHuella, modelPath } = modelo;
  const fragmentos = trocear(doc.contenidoTexto, parametros);

  if (fragmentos.length === 0) {
    // Sin contenido indexable: se limpian los chunks previos (por si el documento
    // se vació al reprocesar) y se termina sin error de embeddings (US3-5).
    await prisma.documentoChunk.deleteMany({ where: { documentoId: doc.id } });
    return { chunksCreados: 0, sinContenido: true };
  }

  const prefijo = construirPrefijo(doc, parametros.enriquecimiento);

  // Se embeben ANTES de tocar la base: si un embedding falla, no dejamos el
  // documento a medio reemplazar (la excepción sube y el worker reintenta).
  const vectorizados: { contenido: string; orden: number; embedding: number[] }[] = [];
  for (const frag of fragmentos) {
    const texto = textoParaVectorizar(frag.contenido, prefijo);
    const res = await embed(texto);
    if (!res.ok || res.embedding.length !== EMBEDDING_DIMS) {
      throw new Error(res.error || `Embedding inválido para el fragmento ${frag.orden}`);
    }
    vectorizados.push({ contenido: frag.contenido, orden: frag.orden, embedding: res.embedding });
  }

  // Reemplazo consistente dentro de una transacción: borrar previos + crear
  // nuevos. Idempotente (FR-009).
  await prisma.$transaction(async (tx) => {
    await tx.documentoChunk.deleteMany({ where: { documentoId: doc.id } });
    for (const v of vectorizados) {
      // Se ALMACENA el contenido plano (nunca el enriquecido, FR-027). El vector
      // va parametrizado como literal pgvector (FR-012, sin concatenación).
      await tx.$executeRaw`
        INSERT INTO "DocumentoChunk" ("id", "documentoId", "contenido", "orden", "embedding", "embeddingModel", "enrichConfig", "createdAt")
        VALUES (${`chk_${randomUUID()}`}, ${doc.id}, ${v.contenido}, ${v.orden}, ${aLiteralVector(v.embedding)}::vector, ${modelPath}, ${enrichConfigHuella}, NOW())
      `;
    }
  });

  return { chunksCreados: vectorizados.length, sinContenido: false };
}
