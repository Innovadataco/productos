/**
 * S-C (D-116/D-117) · Frontera Q-3 del descifrado del relato.
 *
 * `descifrarCampo`/`descifrarCampos` (en `@/lib/reporte-texto-contenido`) necesitan un cliente de
 * Prisma. Los LECTORES fuera del DAL (rutas de API, `src/lib/comite`, `src/lib/expediente`,
 * `src/lib/spam`, …) NO pueden importar `@/lib/prisma` directo (regla `dal-frontera`, Q-3): piden el
 * texto por acá. Esta capa vive DENTRO de `src/lib/dal/`, así que es el único punto autorizado a
 * atar el descifrado al singleton de Prisma. Los servicios/repositorios que YA operan con un
 * `TransactionClient` propio siguen llamando a `descifrarCampo(s)` con SU tx (no pasan por acá).
 *
 * Fail-loud igual que la primitiva: si el contenido o su llave faltan, LANZA (nunca fail-open).
 */
import { prisma } from "@/lib/prisma";
import { descifrarCampo, descifrarCampos } from "@/lib/reporte-texto-contenido";
import type { CampoContenido } from "@/lib/reporte-texto-llaves";

/** Descifra UN campo ("texto" | "textoOriginal") de un contenido, con el singleton de Prisma. */
export function descifrarCampoReporte(contenidoId: string, campo: CampoContenido): Promise<string> {
    return descifrarCampo(prisma, contenidoId, campo);
}

/**
 * Versión BATCH para lectores de LISTA: descifra el mismo `campo` de muchos contenidos con 2 queries.
 * Devuelve `Map<contenidoId, textoDescifrado>` (vacío si la lista viene vacía).
 */
export function descifrarCamposReporte(
    contenidoIds: string[],
    campo: CampoContenido
): Promise<Map<string, string>> {
    return descifrarCampos(prisma, contenidoIds, campo);
}
