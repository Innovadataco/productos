/**
 * SPEC-245 (002-PI-148): autorización manual de una solicitud de suscripción
 * creada en SPEC-244 (`PENDIENTE_AUTORIZACION`).
 *
 * Transita la suscripción a `ACTIVA`, captura los datos del pago manual y emite
 * el evento `suscripcion.activada`.
 */
import { addMonths } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { AccionAudit, EstadoSuscripcion, MetodoPagoManual, TipoTitular, type Suscripcion } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";
import { programar } from "@/lib/notificaciones/motor";
import { mesesDeDuracion } from "./freemium-calculos";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import type { DbClient } from "@/lib/dal/unit-of-work";
import { entregarCuponesRecompensa } from "./entregar-cupones-recompensa.service";

const ZONA_BOGOTA = "America/Bogota";

function ahoraBogota(): Date {
    return toZonedTime(new Date(), ZONA_BOGOTA);
}

function normalizarFechaPagoReal(valor?: Date | string | undefined): Date | null {
    if (!valor) return null;
    return typeof valor === "string" ? new Date(valor) : valor;
}

export interface AutorizarSolicitudPendienteInput {
    adminId: string;
    suscripcionId: string;
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
    suscripcion: { tipoTitular: "PADRE" | "COLEGIO"; usuarioId: string | null; colegioId: string | null },
    db: DbClient
): Promise<DatosTitular | null> {
    if (suscripcion.tipoTitular === "PADRE" && suscripcion.usuarioId) {
        const usuario = await db.usuario.findUnique({
            where: { id: suscripcion.usuarioId },
            select: { id: true, nombre: true, email: true },
        });
        if (!usuario) return null;
        return { id: usuario.id, nombre: usuario.nombre, email: usuario.email };
    }

    if (suscripcion.tipoTitular === "COLEGIO" && suscripcion.colegioId) {
        const colegio = await db.colegio.findUnique({
            where: { id: suscripcion.colegioId },
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
    planNombre: string,
    titular: DatosTitular | null
): Promise<void> {
    const variables = {
        nombre: titular?.nombre ?? "",
        suscripcionId: suscripcion.id,
        plan: planNombre,
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
        console.warn(`[AdminAutorizarSolicitud] Evento activada: motor no disponible (${msg}); se continúa`);
    }
}

/**
 * Autoriza una suscripción `PENDIENTE_AUTORIZACION` capturando el pago manual.
 * La actualización es atómica y usa el estado previo como guard de idempotencia.
 */
export async function autorizarSolicitudPendiente(
    input: AutorizarSolicitudPendienteInput
): Promise<Suscripcion> {
    const resultado = await withUnitOfWork(async (tx) => {
        const repo = new PagosRepository(tx);

        const suscripcionPrev = await repo.obtenerSuscripcionPorId(input.suscripcionId);
        if (!suscripcionPrev) {
            throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        if (suscripcionPrev.estado !== EstadoSuscripcion.PENDIENTE_AUTORIZACION) {
            throw new AppError("La solicitud ya no está pendiente de autorización", ERROR_CODES.CONFLICT, 409);
        }

        const plan = suscripcionPrev.planActual;
        const ahora = ahoraBogota();
        const fechaPagoReal = normalizarFechaPagoReal(input.fechaPagoReal);
        const fechaInicio = fechaPagoReal ?? ahora;
        const fechaFin = addMonths(fechaInicio, mesesDeDuracion(plan.duracion));

        const estadoAnterior = {
            estado: suscripcionPrev.estado,
            fechaInicio: suscripcionPrev.fechaInicio.toISOString(),
            fechaFin: suscripcionPrev.fechaFin.toISOString(),
            metodoPagoManual: suscripcionPrev.metodoPagoManual,
            referenciaPagoManual: suscripcionPrev.referenciaPagoManual,
            montoRealPagado: suscripcionPrev.montoRealPagado,
            fechaPagoReal: suscripcionPrev.fechaPagoReal?.toISOString() ?? null,
        };

        const suscripcion = await repo.actualizarSuscripcion(input.suscripcionId, {
            estado: EstadoSuscripcion.ACTIVA,
            autorizadoPorAdminId: input.adminId,
            autorizadoEn: ahora,
            metodoPagoManual: input.metodoPagoManual,
            referenciaPagoManual: input.referenciaPagoManual,
            montoRealPagado: input.montoRealPagado,
            fechaPagoReal,
            fechaInicio,
            fechaFin,
        });

        const titular = await resolverDatosTitular(suscripcionPrev, tx);

        await logAudit({
            accion: AccionAudit.SUSCRIPCION_ACTIVADA_MANUAL,
            tipoRecurso: "Suscripcion",
            recursoId: suscripcion.id,
            usuarioId: input.adminId,
            valorAnterior: JSON.stringify(estadoAnterior),
            valorNuevo: JSON.stringify({
                estado: suscripcion.estado,
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

    await emitirEventoActivada(resultado.suscripcion, resultado.plan.nombre, resultado.titular);

    // SPEC-246 (002-PI-149): entrega cupones de recompensa al padre tras primer pago pagado.
    if (
        resultado.suscripcion.tipoTitular === TipoTitular.PADRE &&
        !resultado.plan.esFreemium &&
        resultado.suscripcion.usuarioId
    ) {
        try {
            await entregarCuponesRecompensa({
                padreUsuarioId: resultado.suscripcion.usuarioId,
                adminId: input.adminId,
                email: resultado.titular?.email,
                nombre: resultado.titular?.nombre,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[AdminAutorizarSolicitud] Entrega de cupones de recompensa falló (${msg}); se continúa`);
        }
    }

    return resultado.suscripcion;
}
