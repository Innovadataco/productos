/**
 * SPEC-132 (S-4): sesión de carga masiva — el roster de alumnos vive server-side
 * con TTL; el token de confirmación firma SOLO el id de la sesión (sin PII en el JWT).
 * Single-use (O-2): al confirmar con éxito, la sesión se BORRA en la misma
 * transacción del import; el TTL es solo el backstop.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FilaCargaAlumno } from "./parser";

const TTL_MINUTOS = 15;

export type SesionRoster = {
    id: string;
    colegioId: string;
    filas: FilaCargaAlumno[];
    expiraEn: Date;
};

/** Persiste el roster validado y devuelve el id de sesión (expira en 15 min). */
export async function crearSesionRoster(colegioId: string, filas: FilaCargaAlumno[]): Promise<string> {
    const expiraEn = new Date(Date.now() + TTL_MINUTOS * 60 * 1000);
    const sesion = await prisma.cargaRosterSesion.create({
        data: { colegioId, filas: filas as unknown as Prisma.InputJsonValue, expiraEn },
    });
    return sesion.id;
}

/**
 * Lee la sesión aplicando las guardas: existe, no vencida y del MISMO colegio
 * (aislamiento multi-tenant). Devuelve null si no pasa alguna guarda.
 */
export async function obtenerSesionRosterValida(sesionId: string, colegioId: string): Promise<SesionRoster | null> {
    const sesion = await prisma.cargaRosterSesion.findUnique({ where: { id: sesionId } });
    if (!sesion) return null;
    if (sesion.colegioId !== colegioId) return null;
    if (sesion.expiraEn <= new Date()) return null;
    return {
        id: sesion.id,
        colegioId: sesion.colegioId,
        filas: sesion.filas as unknown as FilaCargaAlumno[],
        expiraEn: sesion.expiraEn,
    };
}

/** Borra la sesión (single-use, O-2). Debe correr dentro de la tx del import. */
export async function consumirSesionRoster(sesionId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.cargaRosterSesion.delete({ where: { id: sesionId } });
}

/** Limpieza backstop: borra sesiones vencidas (job periódico del worker). */
export async function purgarSesionesRosterVencidas(): Promise<number> {
    const resultado = await prisma.cargaRosterSesion.deleteMany({
        where: { expiraEn: { lt: new Date() } },
    });
    return resultado.count;
}
