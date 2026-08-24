/**
 * SPEC-215 (002-PI-115): repositorio DAL de consultas del programa de referidos.
 * Vive aparte de `PagosRepository` (mismo patrón que `PagosClienteRepository` de
 * SPEC-211) porque ese archivo ya supera el límite de líneas del lint; la
 * frontera DAL (Q-3) se mantiene: toda query pasa por un repositorio de este
 * directorio.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class PagosReferidosRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Titular de un código propio con estado y datos de contacto (validaciones FR-005). */
    obtenerSuscripcionPorCodigoReferido(codigoReferidoPropio: string) {
        return this.db.suscripcion.findUnique({
            where: { codigoReferidoPropio },
            include: {
                usuario: { select: { id: true, nombre: true, email: true } },
                colegio: {
                    select: {
                        id: true,
                        nombre: true,
                        representanteLegalEmail: true,
                        representanteLegalNombre: true,
                        admin: { select: { id: true, nombre: true, email: true } },
                    },
                },
            },
        });
    }

    /** Unicidad de `Suscripcion.codigoReferidoPropio` para la generación de códigos (FR-003). */
    async existeCodigoReferidoPropio(codigoReferidoPropio: string): Promise<boolean> {
        const count = await this.db.suscripcion.count({ where: { codigoReferidoPropio } });
        return count > 0;
    }

    /** Suscripción con titular por id (para resolver destinatarios de eventos referido.*). */
    obtenerSuscripcionConTitular(id: string) {
        return this.db.suscripcion.findUnique({
            where: { id },
            include: {
                usuario: { select: { id: true, nombre: true, email: true } },
                colegio: {
                    select: {
                        id: true,
                        nombre: true,
                        representanteLegalEmail: true,
                        representanteLegalNombre: true,
                        admin: { select: { id: true, nombre: true, email: true } },
                    },
                },
            },
        });
    }

    /** Uso puntual (referidor, referida) — la unicidad del par la impone el schema. */
    buscarUsoReferido(codigoReferidoUsuarioId: string, suscripcionReferidaId: string) {
        return this.db.codigoReferidoUso.findUnique({
            where: {
                codigoReferidoUsuarioId_suscripcionReferidaId: {
                    codigoReferidoUsuarioId,
                    suscripcionReferidaId,
                },
            },
        });
    }

    /** Uso aún no activado de una suscripción referida (hook de `pago.autorizado`). */
    obtenerUsoReferidoPendiente(suscripcionReferidaId: string) {
        return this.db.codigoReferidoUso.findFirst({
            where: { suscripcionReferidaId, fechaActivacion: null },
            orderBy: { fechaRegistro: "asc" },
        });
    }

    actualizarCodigoReferidoUso(id: string, data: Prisma.CodigoReferidoUsoUncheckedUpdateInput) {
        return this.db.codigoReferidoUso.update({ where: { id }, data });
    }

    /** Usos activados del año de un referidor (para el aviso del N-ésimo uso, FR-008). */
    contarUsosReferidosActivadosPorAnio(referidorId: string, anio: number) {
        return this.db.codigoReferidoUso.count({
            where: {
                codigoReferidoUsuarioId: referidorId,
                anio,
                fechaActivacion: { not: null },
            },
        });
    }

    /** Emails de admins activos de la plataforma (destinatarios de `referido.tope_anual`). */
    listarEmailsAdminActivos() {
        return this.db.usuario.findMany({
            where: { rol: "ADMIN", estado: "activo" },
            select: { email: true },
        });
    }
}
