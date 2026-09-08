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
 * SPEC-584 (Fase 2): esta frontera es TAMBIÉN el punto donde cada lectura queda auditada
 * (`LecturaReporte`). Por cada campo descifrado que sale hacia un lector se registra quién
 * (actor del hilo ALS, ver `src/lib/auditoria-lectura/actor.ts`), qué campo y el hash del
 * contenido visto — nunca el texto literal. La auditoría es fail-loud: sin rastro no hay lectura.
 *
 * Fail-loud igual que la primitiva: si el contenido o su llave faltan, LANZA (nunca fail-open).
 */
import { prisma } from "@/lib/prisma";
import { descifrarCampo, descifrarCampos } from "@/lib/reporte-texto-contenido";
import type { CampoContenido } from "@/lib/reporte-texto-llaves";
import { registrarLecturaTexto, type DuenoContenido } from "./auditoria-lectura";

/**
 * Resuelve el dueño (reporte o evento de expediente) de cada contenido con 2 queries
 * (mismo espíritu que el batch del descifrado). Los reportes traen además su dueño
 * autenticado e identificador para la notificación al padre.
 */
async function resolverDuenos(contenidoIds: string[]): Promise<Map<string, DuenoContenido>> {
    const duenos = new Map<string, DuenoContenido>();
    if (contenidoIds.length === 0) return duenos;
    const [reportes, eventos] = await Promise.all([
        prisma.reporte.findMany({
            where: { contenidoId: { in: contenidoIds } },
            select: { id: true, contenidoId: true, usuarioId: true, identificador: true },
        }),
        prisma.eventoExpediente.findMany({
            where: { contenidoId: { in: contenidoIds } },
            select: { id: true, contenidoId: true },
        }),
    ]);
    for (const r of reportes) {
        duenos.set(r.contenidoId, {
            reporteId: r.id,
            duenoUsuarioId: r.usuarioId,
            identificador: r.identificador,
        });
    }
    for (const e of eventos) {
        duenos.set(e.contenidoId, { eventoId: e.id });
    }
    return duenos;
}

/**
 * SPEC-592 (2026-09-08): el RENDER de una pantalla NO es una acción de lectura.
 * `registrarLecturaTexto` acepta `{ registrarLectura: false }` para los caminos
 * donde el texto acompaña la vista pero el dueño no hizo clic en «Revelar» ni en
 * «Ver texto» (p. ej. el detalle de la bandeja admin). La auditoría (y el aviso
 * al padre) quedan reservadas para las acciones explícitas.
 */
export interface OpcionesDescifrado {
    /** Default true. false = no escribir fila en LecturaReporte (render, no acción). */
    registrarLectura?: boolean;
}

/** Descifra UN campo ("texto" | "textoOriginal") de un contenido, con el singleton de Prisma. */
export async function descifrarCampoReporte(
    contenidoId: string,
    campo: CampoContenido,
    opciones: OpcionesDescifrado = {}
): Promise<string> {
    const texto = await descifrarCampo(prisma, contenidoId, campo);
    if (opciones.registrarLectura === false) return texto;
    const duenos = await resolverDuenos([contenidoId]);
    await registrarLecturaTexto(contenidoId, campo, texto, duenos.get(contenidoId) ?? {});
    return texto;
}

/**
 * Versión BATCH para lectores de LISTA: descifra el mismo `campo` de muchos contenidos con 2 queries.
 * Devuelve `Map<contenidoId, textoDescifrado>` (vacío si la lista viene vacía).
 * SPEC-584: una fila de auditoría por reporte/campo visto (no por campo duplicado).
 */
export async function descifrarCamposReporte(
    contenidoIds: string[],
    campo: CampoContenido
): Promise<Map<string, string>> {
    const textos = await descifrarCampos(prisma, contenidoIds, campo);
    const duenos = await resolverDuenos([...textos.keys()]);
    for (const [contenidoId, texto] of textos) {
        await registrarLecturaTexto(contenidoId, campo, texto, duenos.get(contenidoId) ?? {});
    }
    return textos;
}
