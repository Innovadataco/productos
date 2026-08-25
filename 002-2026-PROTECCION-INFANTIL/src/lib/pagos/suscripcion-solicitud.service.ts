/**
 * SPEC-244 (002-PI-147): solicitud de plan por cliente (padre o colegio).
 * Crea una suscripción en estado PENDIENTE_AUTORIZACION con origen
 * SOLICITADA_CLIENTE; el admin la autorizará manualmente en SPEC-245.
 */
import { EstadoSuscripcion, OrigenSuscripcion, TipoTitular } from "@prisma/client";
import type { RolUsuario, Suscripcion } from "@prisma/client";
import { addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";
import { programar } from "@/lib/notificaciones/motor";
import { generarCodigoReferidoUnico } from "./referido.service";
import { calcularTotales, type DesglosePago } from "./calculo-totales.service";
import { anioBogota } from "./renovacion-calculos";
import type { UsuarioTitular } from "./suscripcion-vista.service";

const ZONA_BOGOTA = "America/Bogota";

export interface SolicitarPlanInput {
    usuario: UsuarioTitular & { email?: string | undefined; nombre?: string | null };
    planId: string;
    codigoBono?: string | undefined;
    rolDueño: RolUsuario;
}

export interface SolicitarPlanResultado {
    suscripcion: Suscripcion;
    desglose: DesglosePago;
}

function rolATipoTitular(rol: RolUsuario): "COLEGIO" | "PADRE" {
    if (rol === "SCHOOL_ADMIN") return "COLEGIO";
    if (rol === "PARENT") return "PADRE";
    throw new AppError("Rol no puede solicitar suscripción", ERROR_CODES.FORBIDDEN, 403);
}

function ahoraBogota(): Date {
    return toZonedTime(new Date(), ZONA_BOGOTA);
}

function emitirEventoSolicitada(
    suscripcion: Suscripcion,
    usuario: SolicitarPlanInput["usuario"],
    planNombre: string
): void {
    const variablesBase = {
        nombre: usuario.nombre ?? "",
        planNombre,
        suscripcionId: suscripcion.id,
    };

    const destinatarios: Array<{ usuarioId?: string | undefined; email?: string | undefined; variables: Record<string, unknown> }> = [];

    if (usuario.email) {
        destinatarios.push({
            email: usuario.email,
            variables: variablesBase,
        });
    }

    void (async () => {
        try {
            const admins = await new AnomaliaRepository().listarAdminsActivos();
            for (const admin of admins) {
                destinatarios.push({
                    usuarioId: admin.id,
                    variables: variablesBase,
                });
            }

            if (destinatarios.length > 0) {
                await programar({
                    evento: "suscripcion.solicitada",
                    sujetoTipo: "Suscripcion",
                    sujetoId: suscripcion.id,
                    destinatarios,
                });
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[SuscripcionSolicitud] Evento solicitada: motor no disponible (${msg}); se continúa`);
        }
    })();
}

/**
 * Crea una solicitud de suscripción pendiente de autorización por admin.
 */
export async function solicitarPlan(input: SolicitarPlanInput): Promise<SolicitarPlanResultado> {
    const repo = new PagosRepository();
    const tipoTitular = rolATipoTitular(input.rolDueño);

    const plan = await repo.obtenerPlanPorId(input.planId);
    if (!plan) {
        throw new AppError("Plan no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    if (!plan.activo) {
        throw new AppError("El plan no está activo", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (plan.anio !== anioBogota()) {
        throw new AppError("El plan no corresponde al año actual", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (plan.tipoTitular !== tipoTitular) {
        throw new AppError("El plan no aplica a tu tipo de cuenta", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const filtroTitular =
        tipoTitular === "COLEGIO"
            ? { colegioId: input.usuario.colegioId ?? undefined }
            : { usuarioId: input.usuario.id };

    if (filtroTitular.colegioId === undefined && filtroTitular.usuarioId === undefined) {
        throw new AppError("No se pudo determinar el titular de la suscripción", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const existeVigente = await repo.existeSuscripcionVigenteParaTitular(filtroTitular);
    if (existeVigente) {
        throw new AppError("Ya existe una suscripción vigente para este titular", ERROR_CODES.CONFLICT, 409);
    }

    const desglose = await calcularTotales(plan, tipoTitular, input.codigoBono, input.usuario.id);

    const ahora = ahoraBogota();
    const fechaFinPlaceholder = addDays(ahora, 1);
    const codigoReferidoPropio = await generarCodigoReferidoUnico(tipoTitular);

    const data = {
        tipoTitular,
        planActualId: plan.id,
        estado: EstadoSuscripcion.PENDIENTE_AUTORIZACION,
        origen: OrigenSuscripcion.SOLICITADA_CLIENTE,
        esFreemium: false,
        fechaInicio: ahora,
        fechaFin: fechaFinPlaceholder,
        monedaLocal: "COP",
        paisCliente: "CO",
        codigoReferidoPropio,
        ...(tipoTitular === "COLEGIO" ? { colegioId: input.usuario.colegioId } : { usuarioId: input.usuario.id }),
    };

    const suscripcion = await repo.crearSuscripcion(data);

    await logAudit({
        accion: "PAGO_REPORTADO",
        tipoRecurso: "Suscripcion",
        recursoId: suscripcion.id,
        usuarioId: input.usuario.id,
        colegioId: input.usuario.colegioId ?? undefined,
        valorNuevo: JSON.stringify({
            planId: plan.id,
            planNombre: plan.nombre,
            tipoTitular,
            codigoBono: input.codigoBono,
            desglose,
        }),
        metadatos: { planId: plan.id, codigoBono: input.codigoBono },
    });

    emitirEventoSolicitada(suscripcion, input.usuario, plan.nombre);

    console.warn(`[SuscripcionSolicitud] Creada ${suscripcion.id} — PENDIENTE_AUTORIZACION para ${tipoTitular}`);

    return { suscripcion, desglose };
}
