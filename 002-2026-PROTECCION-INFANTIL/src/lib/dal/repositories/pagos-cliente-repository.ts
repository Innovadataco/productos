/**
 * SPEC-211 (002-PI-111): repositorio DAL de las vistas de cliente del módulo de
 * pagos (rector + padre). Consultas que no existían en `PagosRepository`
 * (SPEC-210/212); lo nuevo vive aquí para no tocar archivos de otras SPECs.
 */
import type { Prisma, TipoTitular } from "@prisma/client";
import { EstadoPago } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_SUSCRIPCION = {
    planActual: true,
    colegio: { select: { id: true, nombre: true } },
    usuario: { select: { id: true, nombre: true, email: true } },
} satisfies Prisma.SuscripcionInclude;

export class PagosClienteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Suscripción más reciente del colegio (cualquier estado; la vista muestra también CANCELADA). */
    obtenerSuscripcionActualDeColegio(colegioId: string) {
        return this.db.suscripcion.findFirst({
            where: { colegioId },
            orderBy: { createdAt: "desc" },
            include: INCLUDE_SUSCRIPCION,
        });
    }

    /** Suscripción más reciente del padre. */
    obtenerSuscripcionActualDeUsuario(usuarioId: string) {
        return this.db.suscripcion.findFirst({
            where: { usuarioId },
            orderBy: { createdAt: "desc" },
            include: INCLUDE_SUSCRIPCION,
        });
    }

    /** Pago en PENDIENTE_AUTORIZACION de la suscripción (a lo sumo uno por flujo de renovación). */
    obtenerPagoPendiente(suscripcionId: string) {
        return this.db.pago.findFirst({
            where: { suscripcionId, estado: EstadoPago.PENDIENTE_AUTORIZACION },
            orderBy: { createdAt: "desc" },
        });
    }

    /** Totales históricos pagados: solo pagos AUTORIZADO (reembolsados no suman). */
    sumarPagosAutorizados(suscripcionId: string) {
        return this.db.pago.aggregate({
            where: { suscripcionId, estado: EstadoPago.AUTORIZADO },
            _sum: { montoNetoUSD: true, montoLocalPagado: true },
        });
    }

    /** Bonos pre-aplicados a la suscripción que aún no están vinculados a un pago. */
    listarBonosPendientesDePago(suscripcionId: string) {
        return this.db.bonoAplicado.findMany({
            where: { suscripcionId, pagoId: null },
            include: { bono: true },
            orderBy: { aplicadoEn: "asc" },
        });
    }

    /** Vincula bonos pre-aplicados al pago de renovación que los consume. */
    vincularBonosAPago(bonoAplicadoIds: string[], pagoId: string) {
        if (bonoAplicadoIds.length === 0) return Promise.resolve({ count: 0 });
        return this.db.bonoAplicado.updateMany({
            where: { id: { in: bonoAplicadoIds } },
            data: { pagoId },
        });
    }

    /** Titular de un código de referido (para validar `codigoReferido` en renovación). */
    buscarSuscripcionPorCodigoReferido(codigoReferidoPropio: string) {
        return this.db.suscripcion.findUnique({
            where: { codigoReferidoPropio },
            select: { id: true },
        });
    }

    /** Planes activos de un tipo de titular para un año (opciones del formulario de renovación). */
    listarPlanesActivosPorTitular(tipoTitular: TipoTitular, anio: number) {
        return this.db.plan.findMany({
            where: { tipoTitular, anio, activo: true },
            orderBy: { duracion: "asc" },
        });
    }
}
