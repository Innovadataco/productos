/**
 * SPEC-245 (002-PI-148): activación manual de suscripción por admin.
 *
 * Crea una `Suscripcion` `ACTIVA` con origen `ACTIVADA_MANUAL_ADMIN` a partir de
 * un pago manual capturado en el panel administrativo.
 */
import { addMonths } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
    AccionAudit,
    EstadoSuscripcion,
    MetodoPagoManual,
    OrigenSuscripcion,
    TipoTitular,
    type Plan,
    type Suscripcion,
} from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { PagosReferidosRepository } from "@/lib/dal/repositories/pagos-referidos-repository";
import { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";
import { programar } from "@/lib/notificaciones/motor";
import { generarCodigoReferidoUnico } from "./referido.service";
import { mesesDeDuracion } from "./freemium-calculos";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import type { DbClient } from "@/lib/dal/unit-of-work";

const ZONA_BOGOTA = "America/Bogota";

function ahoraBogota(): Date {
    return toZonedTime(new Date(), ZONA_BOGOTA);
}

function normalizarFechaPagoReal(valor?: Date | string | undefined): Date | null {
    if (!valor) return null;
    return typeof valor === "string" ? new Date(valor) : valor;
}

export interface ActivarSuscripcionManualInput {
    adminId: string;
    target: {
        tipoTitular: TipoTitular;
        usuarioId?: string | undefined;
        colegioId?: string | undefined;
    };
    planId: string;
    metodoPagoManual: MetodoPagoManual;
    referenciaPagoManual: string;
    montoRealPagado: number;
    fechaPagoReal?: Date | string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

interface DatosTitular {
    id: string;
    nombre: string | null;
    email: string;
}

async function resolverDatosTitular(
    target: ActivarSuscripcionManualInput["target"],
    db: DbClient
): Promise<DatosTitular | null> {
    if (target.tipoTitular === "PADRE" && target.usuarioId) {
        const usuario = await db.usuario.findUnique({
            where: { id: target.usuarioId },
            select: { id: true, nombre: true, email: true },
        });
        if (!usuario) return null;
        return { id: usuario.id, nombre: usuario.nombre, email: usuario.email };
    }

    if (target.tipoTitular === "COLEGIO" && target.colegioId) {
        const colegio = await db.colegio.findUnique({
            where: { id: target.colegioId },
            select: {
                id: true,
                nombre: true,
                representanteLegalEmail: true,
                representanteLegalNombre: true,
                admin: { select: { email: true, nombre: true } },
            },
        });
        if (!colegio) return null;
        return {
            id: colegio.id,
            nombre: colegio.admin?.nombre ?? colegio.representanteLegalNombre ?? colegio.nombre,
            email: colegio.admin?.email ?? colegio.representanteLegalEmail,
        };
    }

    return null;
}

async function emitirEventoActivada(
    suscripcion: Suscripcion,
    plan: Plan,
    titular: DatosTitular | null
): Promise<void> {
    const variables = {
        nombre: titular?.nombre ?? "",
        suscripcionId: suscripcion.id,
        plan: plan.nombre,
        monto: suscripcion.montoRealPagado,
        fechaInicio: suscripcion.fechaInicio.toISOString(),
        fechaFin: suscripcion.fechaFin.toISOString(),
    };

    const destinatarios: Array<{ usuarioId?: string | undefined; email?: string | undefined; variables: Record<string, unknown> }> = [];

    if (titular?.email) {
        destinatarios.push({ email: titular.email, variables });
    }

    try {
        const admins = await new AnomaliaRepository().listarAdminsActivos();
        for (const admin of admins) {
            destinatarios.push({ usuarioId: admin.id, variables });
        }

        if (destinatarios.length > 0) {
            await programar({
                evento: "suscripcion.activada",
                sujetoTipo: "Suscripcion",
                sujetoId: suscripcion.id,
                destinatarios,
            });
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[AdminActivacionManual] Evento activada: motor no disponible (${msg}); se continúa`);
    }
}

/**
 * Crea una suscripción activa de forma atómica a partir de un pago manual.
 */
export async function activarSuscripcionManual(input: ActivarSuscripcionManualInput): Promise<Suscripcion> {
    const resultado = await withUnitOfWork(async (tx) => {
        const repo = new PagosRepository(tx);

        const plan = await repo.obtenerPlanPorId(input.planId);
        if (!plan) {
            throw new AppError("Plan no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (!plan.activo) {
            throw new AppError("El plan no está activo", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (plan.tipoTitular !== input.target.tipoTitular) {
            throw new AppError("El plan no aplica al tipo de titular", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (plan.esFreemium) {
            throw new AppError("No se puede activar manualmente un plan freemium", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const filtroTitular =
            input.target.tipoTitular === "COLEGIO"
                ? { colegioId: input.target.colegioId }
                : { usuarioId: input.target.usuarioId };

        if (!filtroTitular.colegioId && !filtroTitular.usuarioId) {
            throw new AppError("No se pudo determinar el titular de la suscripción", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const existeVigente = await repo.existeSuscripcionVigenteParaTitular(filtroTitular);
        if (existeVigente) {
            throw new AppError("Ya existe una suscripción vigente para este titular", ERROR_CODES.CONFLICT, 409);
        }

        const ahora = ahoraBogota();
        const fechaPagoReal = normalizarFechaPagoReal(input.fechaPagoReal);
        const fechaInicio = fechaPagoReal ?? ahora;
        const fechaFin = addMonths(fechaInicio, mesesDeDuracion(plan.duracion));

        const codigoReferidoPropio = await generarCodigoReferidoUnico(
            input.target.tipoTitular,
            new PagosReferidosRepository(tx)
        );

        const colegioId = input.target.colegioId ?? null;
        const usuarioId = input.target.usuarioId ?? null;

        const suscripcion = await repo.crearSuscripcion({
            tipoTitular: input.target.tipoTitular,
            planActualId: plan.id,
            estado: EstadoSuscripcion.ACTIVA,
            origen: OrigenSuscripcion.ACTIVADA_MANUAL_ADMIN,
            esFreemium: false,
            fechaInicio,
            fechaFin,
            monedaLocal: "COP",
            paisCliente: "CO",
            codigoReferidoPropio,
            metodoPagoManual: input.metodoPagoManual,
            referenciaPagoManual: input.referenciaPagoManual,
            montoRealPagado: input.montoRealPagado,
            fechaPagoReal,
            autorizadoPorAdminId: input.adminId,
            autorizadoEn: ahora,
            colegioId: input.target.tipoTitular === "COLEGIO" ? colegioId : null,
            usuarioId: input.target.tipoTitular === "PADRE" ? usuarioId : null,
        });

        const titular = await resolverDatosTitular(input.target, tx);

        await logAudit({
            accion: AccionAudit.SUSCRIPCION_ACTIVADA_MANUAL,
            tipoRecurso: "Suscripcion",
            recursoId: suscripcion.id,
            usuarioId: input.adminId,
            valorAnterior: JSON.stringify({ estado: null, planId: null }),
            valorNuevo: JSON.stringify({
                estado: suscripcion.estado,
                planId: plan.id,
                planNombre: plan.nombre,
                tipoTitular: input.target.tipoTitular,
                metodoPagoManual: input.metodoPagoManual,
                referenciaPagoManual: input.referenciaPagoManual,
                montoRealPagado: input.montoRealPagado,
                fechaPagoReal: fechaPagoReal?.toISOString() ?? null,
                fechaInicio: fechaInicio.toISOString(),
                fechaFin: fechaFin.toISOString(),
                autorizadoPorAdminId: input.adminId,
            }),
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            metadatos: { planId: plan.id, titularId: titular?.id },
            tx,
        });

        return { suscripcion, plan, titular };
    });

    await emitirEventoActivada(resultado.suscripcion, resultado.plan, resultado.titular);
    return resultado.suscripcion;
}
