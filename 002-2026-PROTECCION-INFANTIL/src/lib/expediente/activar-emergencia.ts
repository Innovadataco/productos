/**
 * SPEC-239 (002-PI-mega-cola): servicio de activación de emergencia de un
 * expediente ROJO (US3, FR-005). Lógica de negocio desacoplada del
 * request/response; el endpoint vive en
 * `src/app/api/admin/comite/expediente/[id]/activar-emergencia/route.ts`.
 *
 * Flujo:
 * 1. Verifica que el expediente existe y está en gravedad ROJO (409 si no).
 * 2. Anti doble activación: si ya hay una activación en los últimos 5 minutos
 *    para el mismo expediente → 409 (edge case "Activación doble").
 * 3. Deja el estado en PENDIENTE_COMITE o EN_APROBACION_PADRE: si ya está en
 *    uno de esos se conserva; si no, se mueve a PENDIENTE_COMITE vía
 *    `marcarEscaladoRojo` (la whitelist de transiciones del motor no cubre
 *    "* → PENDIENTE_COMITE"; queda auditado — decisión documentada en cierre).
 * 4. Selecciona el contacto ACTIVO de menor prioridad (1 → 2 → 3, D4); sin
 *    activos → 409 + auditoría EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS.
 * 5. Publica el evento `expediente.emergencia.activada` en Motor Notif
 *    (`programar`) dirigido al contacto. Canal: EMAIL (Motor Notif solo
 *    soporta EMAIL/IN_APP; el canal SMS de la spec no existe en el motor y su
 *    código no puede modificarse — desviación documentada en cierre.md). Si el
 *    contacto no tiene email, la programación se omite sin fallar (202 con
 *    advertencia, edge case "Fallo del Motor Notif").
 * 6. Registra AuditLog EXPEDIENTE_EMERGENCIA_ACTIVADA (metadatos nivel
 *    CRITICAL, activadorId, contactoId, expedienteId). NUNCA texto de reportes.
 */
import { EstadoExpediente, ScoreGravedad } from "@prisma/client";
import type { ContactoEmergencia, Expediente } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { programar } from "@/lib/notificaciones";
import { ContactoEmergenciaRepository } from "@/lib/dal/repositories/contacto-emergencia";
import { ExpedienteMotorRepository } from "@/lib/dal/repositories/expediente-motor-repository";

export const EVENTO_EMERGENCIA_ACTIVADA = "expediente.emergencia.activada";

/** Ventana anti doble activación (edge case "Activación doble"). */
const VENTANA_DOBLE_ACTIVACION_MS = 5 * 60 * 1000;

const ESTADOS_VIGILADOS: readonly EstadoExpediente[] = [
    EstadoExpediente.PENDIENTE_COMITE,
    EstadoExpediente.EN_APROBACION_PADRE,
];

export interface ResultadoActivarEmergencia {
    expediente: Expediente;
    contacto: ContactoEmergencia;
    notificacionProgramada: boolean;
    eventoPublicado: string;
    advertencia?: string | undefined;
}

export interface ActivarEmergenciaContexto {
    activadorId: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export async function activarEmergencia(
    expedienteId: string,
    ctx: ActivarEmergenciaContexto
): Promise<ResultadoActivarEmergencia> {
    const repoExpediente = new ExpedienteMotorRepository();
    const repoContactos = new ContactoEmergenciaRepository();

    const expediente = await repoExpediente.obtenerPorId(expedienteId);
    if (!expediente) {
        throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }

    if (expediente.scoreGravedadActual !== ScoreGravedad.ROJO) {
        throw new AppError(
            "Solo se puede activar emergencia en expedientes con gravedad ROJO",
            "GRAVEDAD_NO_ROJO",
            409
        );
    }

    const desde = new Date(Date.now() - VENTANA_DOBLE_ACTIVACION_MS);
    const activacionReciente = await repoExpediente.obtenerUltimaActivacionEmergencia(expediente.id, desde);
    if (activacionReciente) {
        throw new AppError(
            "Ya existe una activación de emergencia reciente para este expediente",
            "EMERGENCIA_YA_ACTIVADA",
            409
        );
    }

    const contactos = await repoContactos.findActivosPorPadre(expediente.padreUsuarioId);
    if (contactos.length === 0) {
        await logAudit({
            accion: "EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS",
            tipoRecurso: "Expediente",
            recursoId: expediente.id,
            usuarioId: ctx.activadorId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            metadatos: { nivel: "CRITICAL", activadorId: ctx.activadorId },
        });
        throw new AppError(
            "No hay contactos de emergencia activos para este padre",
            "SIN_CONTACTOS_EMERGENCIA",
            409
        );
    }

    const contacto = contactos[0]!;
    if (contacto.prioridad !== 1) {
        await logAudit({
            accion: "CONTACTO_EMERGENCIA_FALLBACK_USADO",
            tipoRecurso: "ContactoEmergencia",
            recursoId: contacto.id,
            usuarioId: ctx.activadorId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            metadatos: {
                expedienteId: expediente.id,
                prioridadUsada: contacto.prioridad,
            },
        });
    }

    const estadoObjetivo = ESTADOS_VIGILADOS.includes(expediente.estado)
        ? expediente.estado
        : EstadoExpediente.PENDIENTE_COMITE;

    const expedienteActualizado = await repoExpediente.marcarEscaladoRojo(expediente.id, {
        estado: estadoObjetivo,
    });

    // Notificación urgente al contacto (best-effort: nunca revierte la activación).
    let notificacionProgramada = false;
    let advertencia: string | undefined;
    if (!contacto.email) {
        advertencia = "El contacto prioritario no tiene email; no se pudo programar la notificación";
        console.warn(
            `[Expediente/Emergencia] Contacto sin email: contacto=${contacto.id} expediente=${expediente.id}`
        );
    } else {
        try {
            const padreNombre = await repoExpediente.obtenerNombrePadre(expediente.padreUsuarioId);
            const resultado = await programar({
                evento: EVENTO_EMERGENCIA_ACTIVADA,
                sujetoTipo: "Expediente",
                sujetoId: expediente.id,
                destinatarios: [
                    {
                        email: contacto.email,
                        variables: {
                            contactoNombre: contacto.nombre,
                            relacion: contacto.relacion,
                            telefono: contacto.telefono,
                            expedienteNumero: expediente.id,
                            padreNombre: padreNombre ?? "",
                        },
                    },
                ],
                metadatos: {
                    expedienteId: expediente.id,
                    contactoId: contacto.id,
                    activadorId: ctx.activadorId,
                },
            });
            notificacionProgramada = resultado.programadas > 0;
            if (!notificacionProgramada) {
                advertencia = "Motor Notif no programó la notificación (sin reglas activas o preferencias)";
            }
        } catch (error) {
            advertencia = "Fallo al programar la notificación en Motor Notif";
            console.error(
                `[Expediente/Emergencia] programar falló: expediente=${expediente.id} —`,
                error instanceof Error ? error.message : error
            );
        }
    }

    await logAudit({
        accion: "EXPEDIENTE_EMERGENCIA_ACTIVADA",
        tipoRecurso: "Expediente",
        recursoId: expediente.id,
        usuarioId: ctx.activadorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadatos: {
            nivel: "CRITICAL",
            activadorId: ctx.activadorId,
            contactoId: contacto.id,
            expedienteId: expediente.id,
            prioridadContacto: contacto.prioridad,
            notificacionProgramada,
        },
    });

    return {
        expediente: expedienteActualizado,
        contacto,
        notificacionProgramada,
        eventoPublicado: EVENTO_EMERGENCIA_ACTIVADA,
        advertencia,
    };
}
