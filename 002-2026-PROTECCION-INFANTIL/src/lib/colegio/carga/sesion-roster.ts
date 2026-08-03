/**
 * SPEC-132 (S-4): sesión de carga masiva — el roster de alumnos vive server-side
 * con TTL; el token de confirmación firma SOLO el id de la sesión (sin PII en el JWT).
 * Single-use (O-2): al confirmar con éxito, la sesión se BORRA en la misma
 * transacción del import; el TTL es solo el backstop.
 *
 * SPEC-134 (E-1): fachada fina sobre `CargaRosterSesionRepository` — las firmas
 * públicas quedan intactas (rutas, tests y worker las consumen); el acceso a datos
 * vive en el DAL.
 */
import type { Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { CargaRosterSesionRepository } from "@/lib/dal/repositories/carga-roster-sesion";
import type { FilaCargaEstudiante } from "./parser";

export type { SesionRoster } from "@/lib/dal/repositories/carga-roster-sesion";

/** Persiste el roster validado y devuelve el id de sesión (expira en 15 min). */
export function crearSesionRoster(colegioId: string, filas: FilaCargaEstudiante[]): Promise<string> {
    return new CargaRosterSesionRepository().crear(colegioId, filas);
}

/**
 * Lee la sesión aplicando las guardas: existe, no vencida y del MISMO colegio
 * (aislamiento multi-tenant). Devuelve null si no pasa alguna guarda.
 */
export function obtenerSesionRosterValida(sesionId: string, colegioId: string) {
    return new CargaRosterSesionRepository().obtenerValida(sesionId, colegioId);
}

/**
 * Borra la sesión (single-use, O-2). Debe correr dentro de la tx del import.
 * El tenant se resuelve por la propia sesión (firma histórica sin colegioId).
 */
export async function consumirSesionRoster(sesionId: string, tx: Prisma.TransactionClient): Promise<void> {
    const repo = new CargaRosterSesionRepository(tx);
    const sesion = await repo.obtenerPorId(sesionId);
    if (!sesion) {
        throw new AppError("La validación expiró o no existe; vuelve a validar el archivo", ERROR_CODES.NOT_FOUND, 404);
    }
    await repo.consumir(sesion.colegioId, sesionId);
}

/** Limpieza backstop: borra sesiones vencidas (job periódico del worker). */
export function purgarSesionesRosterVencidas(): Promise<number> {
    return new CargaRosterSesionRepository().purgarExpiradas();
}
