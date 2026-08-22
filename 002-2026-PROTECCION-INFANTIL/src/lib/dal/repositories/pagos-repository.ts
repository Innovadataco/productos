/**
 * SPEC-210 (002-PI-110): repositorio DAL del módulo de pagos.
 * Aísla el acceso a Prisma; endpoints y servicios de pagos deben usar esta
 * clase en lugar de importar `@/lib/prisma` directamente.
 */
import type { Prisma } from "@prisma/client";
import { TipoTitular, DuracionPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class PagosRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    // ── Plan ──

    crearPlan(data: Prisma.PlanUncheckedCreateInput) {
        return this.db.plan.create({ data });
    }

    obtenerPlanPorId(id: string) {
        return this.db.plan.findUnique({ where: { id } });
    }

    obtenerPlanPorClave(tipoTitular: TipoTitular, duracion: DuracionPlan, anio: number) {
        return this.db.plan.findUnique({
            where: {
                tipoTitular_duracion_anio: {
                    tipoTitular,
                    duracion,
                    anio,
                },
            },
        });
    }

    listarPlanes(where?: Prisma.PlanWhereInput) {
        return this.db.plan.findMany({
            where: where ?? {},
            orderBy: { createdAt: "desc" },
        });
    }

    actualizarPlan(id: string, data: Prisma.PlanUncheckedUpdateInput) {
        return this.db.plan.update({ where: { id }, data });
    }

    // ── Suscripción ──

    crearSuscripcion(data: Prisma.SuscripcionUncheckedCreateInput) {
        return this.db.suscripcion.create({ data });
    }

    obtenerSuscripcionPorId(id: string) {
        return this.db.suscripcion.findUnique({ where: { id } });
    }

    listarSuscripcionesPorColegio(colegioId: string) {
        return this.db.suscripcion.findMany({ where: { colegioId } });
    }

    listarSuscripcionesPorUsuario(usuarioId: string) {
        return this.db.suscripcion.findMany({ where: { usuarioId } });
    }

    actualizarSuscripcion(id: string, data: Prisma.SuscripcionUncheckedUpdateInput) {
        return this.db.suscripcion.update({ where: { id }, data });
    }

    // ── Pago ──

    crearPago(data: Prisma.PagoUncheckedCreateInput) {
        return this.db.pago.create({ data });
    }

    obtenerPagoPorId(id: string) {
        return this.db.pago.findUnique({ where: { id } });
    }

    listarPagosPorSuscripcion(suscripcionId: string) {
        return this.db.pago.findMany({
            where: { suscripcionId },
            orderBy: { createdAt: "desc" },
        });
    }

    actualizarPago(id: string, data: Prisma.PagoUncheckedUpdateInput) {
        return this.db.pago.update({ where: { id }, data });
    }

    // ── Bono promocional ──

    crearBonoPromocional(data: Prisma.BonoPromocionalUncheckedCreateInput) {
        return this.db.bonoPromocional.create({ data });
    }

    obtenerBonoPromocionalPorId(id: string) {
        return this.db.bonoPromocional.findUnique({ where: { id } });
    }

    listarBonosActivos(ahora: Date = new Date()) {
        return this.db.bonoPromocional.findMany({
            where: {
                activo: true,
                vigenciaInicio: { lte: ahora },
                vigenciaFin: { gte: ahora },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    // ── Bono aplicado ──

    crearBonoAplicado(data: Prisma.BonoAplicadoUncheckedCreateInput) {
        return this.db.bonoAplicado.create({ data });
    }

    listarBonosAplicados(suscripcionId: string) {
        return this.db.bonoAplicado.findMany({
            where: { suscripcionId },
            orderBy: { aplicadoEn: "desc" },
        });
    }

    // ── Código de referido ──

    crearCodigoReferidoUso(data: Prisma.CodigoReferidoUsoUncheckedCreateInput) {
        return this.db.codigoReferidoUso.create({ data });
    }

    contarReferidosExitososPorAnio(referidorId: string, anio: number) {
        return this.db.codigoReferidoUso.count({
            where: {
                codigoReferidoUsuarioId: referidorId,
                anio,
                recompensaOtorgada: true,
            },
        });
    }

    // ── Tasa de cambio ──

    crearTasaCambio(data: Prisma.TasaCambioUncheckedCreateInput) {
        return this.db.tasaCambio.create({ data });
    }

    obtenerTasaCambioMasReciente(monedaDestino: string) {
        return this.db.tasaCambio.findFirst({
            where: { monedaDestino },
            orderBy: { fecha: "desc" },
        });
    }
}
