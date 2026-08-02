/**
 * SPEC-134 (E-1): repositorio de CargaRosterSesion — tenant obligatorio por
 * construcción. Absorbe el acceso a datos de `src/lib/colegio/carga/sesion-roster.ts`
 * (SPEC-132, S-4/O-2): el roster vive server-side con TTL, la lectura aplica las
 * guardas (existe, MISMO colegio, no vencida) y el consumo es single-use dentro de
 * la tx del import. Acepta un cliente transaccional opcional (D2) — `consumir` DEBE
 * correr con la tx del import (misma semántica actual).
 *
 * EXCEPCIÓN DOCUMENTADA (sin tenant): `purgarExpiradas` es el job backstop global
 * del worker — borra sesiones vencidas de TODOS los colegios (igual que hoy).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";
import type { FilaCargaAlumno } from "@/lib/colegio/carga/parser";

const TTL_MINUTOS = 15;

export type SesionRoster = {
    id: string;
    colegioId: string;
    filas: FilaCargaAlumno[];
    expiraEn: Date;
};

export class CargaRosterSesionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Persiste el roster validado y devuelve el id de sesión (expira en 15 min). */
    async crear(colegioId: string, filas: FilaCargaAlumno[]): Promise<string> {
        const expiraEn = new Date(Date.now() + TTL_MINUTOS * 60 * 1000);
        const sesion = await this.db.cargaRosterSesion.create({
            data: { colegioId, filas: filas as unknown as Prisma.InputJsonValue, expiraEn },
        });
        return sesion.id;
    }

    /**
     * Lee la sesión aplicando las guardas: existe, no vencida y del MISMO colegio
     * (aislamiento multi-tenant). Devuelve null si no pasa alguna guarda.
     */
    async obtenerValida(sesionId: string, colegioId: string): Promise<SesionRoster | null> {
        const sesion = await this.db.cargaRosterSesion.findUnique({ where: { id: sesionId } });
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

    /**
     * Borra la sesión (single-use, O-2) acotada al tenant. Debe correr dentro de
     * la tx del import (inyectar el repo con la tx). 404 si no existe o es ajena.
     */
    async consumir(colegioId: string, sesionId: string): Promise<void> {
        const { count } = await this.db.cargaRosterSesion.deleteMany({
            where: { id: sesionId, colegioId },
        });
        if (count === 0) {
            throw new AppError("La validación expiró o no existe; vuelve a validar el archivo", ERROR_CODES.NOT_FOUND, 404);
        }
    }

    /** Limpieza backstop (EXCEPCIÓN sin tenant): borra sesiones vencidas de todos los colegios. */
    async purgarExpiradas(): Promise<number> {
        const resultado = await this.db.cargaRosterSesion.deleteMany({
            where: { expiraEn: { lt: new Date() } },
        });
        return resultado.count;
    }
}
