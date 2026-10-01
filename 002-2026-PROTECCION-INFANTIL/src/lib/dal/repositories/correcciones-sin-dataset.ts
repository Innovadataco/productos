/**
 * SPEC-812 (pieza 2) · La consulta de PENDIENTES REALES de la derivación de dataset (capa DAL).
 *
 * Responde «¿qué correcciones quedaron SIN dataset derivado y hay que REINTENTAR?» — el ESTADO 1. Va
 * sobre `CorreccionAdmin`, NO sobre `DatasetEntrenamiento`: una corrección que nunca derivó NO produce
 * fila, así que contar filas de dataset jamás encuentra la que falta (corrección del denominador). La
 * consulta separa los tres estados y el trabajo EN VUELO:
 *   · estado 3 (derivado)            → tiene fila de dataset → EXCLUIDO (NOT EXISTS).
 *   · estado 2 (omitido a propósito) → `datasetOmitidoEn` presente → EXCLUIDO. NO es pendiente: es la
 *     conducta de privacidad de 807 (rechazo de anonimización; ver el comentario del schema). Contarlo
 *     sería la fábrica de falsas alarmas que esta spec existe para evitar.
 *   · EN VUELO (recién creada)       → la derivación corre en SEGUNDO PLANO y puede tardar hasta el
 *     timeout de Ollama (el fetch se cuelga); una corrección más joven que la HOLGURA todavía no
 *     terminó y NO es pendiente → EXCLUIDA. Sin esto, el número tendría un fondo permanente de falsos
 *     pendientes y se terminaría ignorando — la misma fábrica de falsas alarmas por otra puerta.
 *   · estado 1 (pendiente REAL)      → sin fila Y sin marca Y más vieja que la holgura → lo que DEVUELVE.
 *
 * HOLGURA POR EDAD: deriva del parámetro VIVO `ia.ollama.timeout_ms` (×2 de margen — el fetch bloquea
 * hasta el timeout, y el factor cubre el agendado del trabajo de fondo y el resto de la tarea). Si
 * alguien cambia el timeout, la holgura lo sigue; NO está clavada en el código. Default 60000 ms si el
 * parámetro falta (el mismo que siembra SPEC-812 pieza 3).
 *
 * Devuelve `[]` (vacío, NO error) si no hay pendientes. Vive en el DAL (acceso directo a Prisma
 * permitido, Q-3). hueco-funcional: su consumidor de PRODUCCIÓN es un monitor de SOLO LECTURA contra la
 * BD viva (T5 / panel admin) que todavía no la importa; HOY la ejercita su candado.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Margen sobre el timeout de Ollama. ×2: el fetch bloquea hasta el timeout; el factor cubre el
 *  agendado del trabajo de fondo + el resto de la tarea. Si cambiás esto, cambiás cuántos «en vuelo»
 *  pueden colarse como pendientes — revisalo contra el tiempo real de la derivación, no a ojo. */
const FACTOR_HOLGURA_SOBRE_TIMEOUT = 2;
/** Mismo default que el reader del timeout y la semilla de la pieza 3 (si el parámetro falta). */
const TIMEOUT_OLLAMA_DEFAULT_MS = 60000;

export interface CorreccionSinDataset {
    correccionId: string;
    creadoEn: Date;
}

/**
 * Correcciones en ESTADO 1 (pendiente real de derivación), ordenadas de la más vieja a la más nueva.
 * `[]` si no hay ninguna. Lee el timeout del parámetro vivo para derivar la holgura por edad.
 */
export async function correccionesSinDataset(db: PrismaClient = prisma): Promise<CorreccionSinDataset[]> {
    const param = await db.parametroSistema.findUnique({
        where: { clave: "ia.ollama.timeout_ms" },
        select: { valor: true },
    });
    const timeoutMs = Number(param?.valor) || TIMEOUT_OLLAMA_DEFAULT_MS;
    const holguraMs = timeoutMs * FACTOR_HOLGURA_SOBRE_TIMEOUT;

    const filas = await db.$queryRaw<Array<{ correccionId: string; creadoEn: Date }>>`
        SELECT c."id" AS "correccionId", c."creadoEn"
        FROM "CorreccionAdmin" c
        WHERE c."datasetOmitidoEn" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "DatasetEntrenamiento" d WHERE d."correccionId" = c."id")
          AND c."creadoEn" < NOW() - make_interval(secs => ${holguraMs}::double precision / 1000.0)
        ORDER BY c."creadoEn" ASC
    `;
    return filas.map((f) => ({ correccionId: f.correccionId, creadoEn: f.creadoEn }));
}
