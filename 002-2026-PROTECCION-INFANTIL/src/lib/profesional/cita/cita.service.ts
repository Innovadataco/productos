/**
 * SPEC-395 (L4) · lógica de la cita profesional.
 *
 * Un solo lugar donde vive la mutación: crear, aprobar-pago, confirmar,
 * reprogramar, reasignar, expirar. Los routes son capas finas de auth + validación
 * que llaman al service. Los workers también entran por acá.
 *
 * Reglas duras del brief §3 codificadas:
 *  · Reprogramación = FILA NUEVA con `solicitudPreviaId` + `pagoHeredadoDeId`.
 *    Una gratis con el MISMO profesional (contador por dupla, hasta 1).
 *  · Reasignación = FILA NUEVA con `pagoHeredadoDeId`, en otro profesional.
 *    La original queda como `NO_ASISTIO_PROFESIONAL` (no cambia por reasignar
 *    normal — solo cuando el profesional no llegó; para reasignar por otro
 *    motivo se usa `REPROGRAMADA`).
 *  · Contador «3 consecutivas vencidas → SUSPENDIDO» + alarma por tasa >1/3.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";

const HORAS_48_MS = 48 * 60 * 60 * 1000;
/** Plazo por default para que el padre complete el pago manual. */
const PLAZO_PAGO_HORAS_DEFAULT = 72;
/** Umbral de la alarma de tasa (§3): «más de un tercio» de vencimientos. */
const UMBRAL_TASA_VENCIMIENTOS = 1 / 3;
/** Umbral de suspensión por consecutivas (§3). */
const MAX_CONSECUTIVAS_ANTES_SUSPENDER = 3;

export interface CrearCitaInput {
    padreUsuarioId: string;
    profesionalId: string;
    franjaId: string;
    presentacion: string;
    urgencia: "ESTA_SEMANA" | "SIN_APURO";
    expedienteCompartidoId?: string | null;
    porcentajeServicio: number;
    plazoPagoHoras?: number;
    pagoHeredadoDeId?: string | null;
    solicitudPreviaId?: string | null;
    /**
     * SPEC-428 (A-75 §9 M4 §4): la primera cita se paga al PRECIO ESTÁNDAR
     * definido por el admin, no a la tarifa del profesional (que aplica a
     * partir de la 2ª cita). Cuando `montoConsultaOverride` viene definido,
     * el service usa este valor en vez de `pro.tarifaConsultaCOP`. La ruta
     * `/api/padre/citas` inyecta el precio estándar leído del parámetro.
     */
    montoConsultaOverride?: number;
}

export async function crearSolicitudCita(input: CrearCitaInput) {
    const franjaRepo = new FranjaDisponibleRepository();
    const franja = await franjaRepo.findById(input.franjaId);
    if (!franja) throw new AppError("Franja no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (franja.profesionalId !== input.profesionalId) {
        throw new AppError("La franja no pertenece a este profesional", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (franja.tomada) {
        throw new AppError("Esta franja ya no está disponible", ERROR_CODES.CONFLICT, 409);
    }

    // L3 unificó el repo (#298): `obtenerPublicoPorId` ya filtra `estado = ACTIVO`
    // y respeta el candado H-2 de campos internos — para validar «existe y
    // acepta citas» alcanza. `tarifaConsultaCOP` está en el DTO público, así
    // que el cálculo de montos sigue funcionando sin destapar campos internos.
    const pro = await new PerfilProfesionalRepository().obtenerPublicoPorId(input.profesionalId);
    if (!pro) {
        throw new AppError(
            "Este profesional no está disponible o no acepta nuevas citas",
            ERROR_CODES.VALIDATION_ERROR,
            400
        );
    }

    const plazoHoras = input.plazoPagoHoras ?? PLAZO_PAGO_HORAS_DEFAULT;
    const venceEn = new Date(Date.now() + plazoHoras * 60 * 60 * 1000);

    // Montos: si hereda pago, se copian de la original (nada de recobrar);
    // si no, se calculan con la tarifa del profesional + porcentaje del sistema.
    let montoConsulta: number;
    let montoServicio: number;
    let montoTotal: number;
    let porcentajeServicio: number;
    const pagoHeredadoDe = input.pagoHeredadoDeId ?? undefined;
    let pagoAprobadoEn: Date | null = null;
    if (pagoHeredadoDe) {
        const heredado = await new SolicitudCitaRepository().findById(pagoHeredadoDe);
        if (!heredado) throw new AppError("Solicitud a heredar no encontrada", ERROR_CODES.NOT_FOUND, 404);
        montoConsulta = heredado.montoConsulta;
        montoServicio = heredado.montoServicio;
        montoTotal = heredado.montoTotal;
        porcentajeServicio = heredado.porcentajeServicio;
        // Hereda el pago → el reloj de 48h arranca YA (no vuelve a esperar
        // aprobación manual del admin).
        pagoAprobadoEn = new Date();
    } else {
        // SPEC-428 §4: la 1ª cita usa el precio ESTÁNDAR (parametrizado por el
        // admin) que la ruta inyecta como override. La tarifa del profesional
        // aplica desde la 2ª cita en adelante y se muestra al padre como
        // informativa en el perfil. Si el caller no envía override (compatibilidad
        // hacia atrás para tests/callers viejos), cae a la tarifa del profesional.
        montoConsulta = input.montoConsultaOverride ?? pro.tarifaConsultaCOP;
        porcentajeServicio = input.porcentajeServicio;
        montoServicio = Math.round((montoConsulta * porcentajeServicio) / 100);
        montoTotal = montoConsulta + montoServicio;
    }

    const creado = await withUnitOfWork(async (tx) => {
        const marc = await new FranjaDisponibleRepository(tx).marcarTomadaSiLibre(input.franjaId);
        if (marc.count === 0) {
            throw new AppError("Esta franja ya no está disponible", ERROR_CODES.CONFLICT, 409);
        }
        const solicitud = await new SolicitudCitaRepository(tx).crear({
            padreUsuario: { connect: { id: input.padreUsuarioId } },
            profesional: { connect: { id: input.profesionalId } },
            franja: { connect: { id: input.franjaId } },
            presentacion: input.presentacion,
            urgencia: input.urgencia,
            estado: pagoAprobadoEn ? "PAGADA_PENDIENTE" : "SIN_CONFIRMAR",
            venceEn,
            ...(pagoAprobadoEn ? { pagoAprobadoEn } : {}),
            ...(input.expedienteCompartidoId
                ? { expedienteCompartido: { connect: { id: input.expedienteCompartidoId } } }
                : {}),
            ...(pagoHeredadoDe ? { pagoHeredadoDe: { connect: { id: pagoHeredadoDe } } } : {}),
            ...(input.solicitudPreviaId ? { solicitudPrevia: { connect: { id: input.solicitudPreviaId } } } : {}),
            montoConsulta,
            montoServicio,
            montoTotal,
            porcentajeServicio,
        });
        return solicitud;
    });

    return creado;
}

export async function aprobarPago(solicitudId: string, adminId: string) {
    const repo = new SolicitudCitaRepository();
    const solicitud = await repo.findById(solicitudId);
    if (!solicitud) throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (solicitud.estado !== "SIN_CONFIRMAR" || solicitud.pagoAprobadoEn !== null) {
        throw new AppError("El pago de esta solicitud ya fue procesado", ERROR_CODES.CONFLICT, 409);
    }
    const ahora = new Date();
    const actualizado = await repo.marcarPagoAprobado(solicitudId, ahora);
    await logAudit({
        accion: "CITA_PROFESIONAL_PAGO_APROBADO",
        tipoRecurso: "SolicitudCita",
        recursoId: solicitudId,
        usuarioId: adminId,
        valorNuevo: JSON.stringify({ pagoAprobadoEn: ahora.toISOString(), montoTotal: solicitud.montoTotal }),
        ipAddress: "admin",
        userAgent: "cita/aprobar-pago",
    });
    return actualizado;
}

export async function confirmarPorProfesional(solicitudId: string, profesionalUsuarioId: string) {
    const repo = new SolicitudCitaRepository();
    const solicitud = await repo.findById(solicitudId);
    if (!solicitud) throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (solicitud.estado !== "PAGADA_PENDIENTE") {
        throw new AppError("Solo se puede confirmar una solicitud pagada y pendiente", ERROR_CODES.CONFLICT, 409);
    }
    // Autorización fina: el profesional dueño lo confirma. `profesionalId` de
    // la solicitud referencia `PerfilProfesional.id`; el `Usuario.id` del
    // profesional se resuelve por el `usuarioId` del perfil.
    const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(profesionalUsuarioId);
    if (!perfil || perfil.id !== solicitud.profesionalId) {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    const actualizado = await repo.marcarConfirmada(solicitudId);
    await logAudit({
        accion: "CITA_PROFESIONAL_CONFIRMADA",
        tipoRecurso: "SolicitudCita",
        recursoId: solicitudId,
        usuarioId: profesionalUsuarioId,
        ipAddress: "profesional",
        userAgent: "cita/confirmar",
    });
    return actualizado;
}

export async function rechazarPorProfesional(solicitudId: string, profesionalUsuarioId: string, motivo?: string) {
    const repo = new SolicitudCitaRepository();
    const solicitud = await repo.findById(solicitudId);
    if (!solicitud) throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (solicitud.estado !== "PAGADA_PENDIENTE") {
        throw new AppError("Solo se puede rechazar una solicitud pagada y pendiente", ERROR_CODES.CONFLICT, 409);
    }
    const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(profesionalUsuarioId);
    if (!perfil || perfil.id !== solicitud.profesionalId) {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    return withUnitOfWork(async (tx) => {
        const upd = await new SolicitudCitaRepository(tx).marcarVencida48h(solicitudId);
        // El profesional rechazó = liberamos la franja (misma consecuencia que
        // «vencida»: se le abre contacto al padre y se reembolsa).
        await new FranjaDisponibleRepository(tx).liberar(solicitud.franjaId);
        await logAudit({
            accion: "CITA_PROFESIONAL_RECHAZADA_PROFESIONAL",
            tipoRecurso: "SolicitudCita",
            recursoId: solicitudId,
            usuarioId: profesionalUsuarioId,
            ...(motivo ? { valorNuevo: JSON.stringify({ motivo }) } : {}),
            ipAddress: "profesional",
            userAgent: "cita/rechazar",
        });
        return upd;
    });
}

export interface ReprogramarInput {
    padreUsuarioId: string;
    solicitudId: string;
    nuevaFranjaId: string;
}

export async function reprogramarPorPadre(input: ReprogramarInput) {
    const repo = new SolicitudCitaRepository();
    const original = await repo.findParaPadre(input.solicitudId, input.padreUsuarioId);
    if (!original) throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
    // Cuenta reprogramaciones previas del padre con este mismo profesional.
    // La regla del brief: UNA gratis por dupla (padre × profesional).
    // Contamos filas donde `solicitudPreviaId` cuelga de una cadena del padre×pro.
    // Simpler: cualquier solicitud del padre × pro con `pagoHeredadoDeId != null`
    // ya usó la reprogramación gratis.
    const yaUsoGratis = (await repo.listarPorPadre(input.padreUsuarioId)).some(
        (s) => s.profesionalId === original.profesionalId && s.pagoHeredadoDeId !== null
    );
    if (yaUsoGratis) {
        throw new AppError(
            "Ya reprogramaste una vez con este profesional. La siguiente es reserva y pago nuevos.",
            ERROR_CODES.CONFLICT,
            409
        );
    }
    if (original.estado !== "CONFIRMADA" && original.estado !== "PAGADA_PENDIENTE") {
        throw new AppError("Solo puedes reprogramar una cita activa", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    // Fila nueva con pagoHeredadoDe = original (arranca PAGADA_PENDIENTE con
    // pagoAprobadoEn = now); la original queda REPROGRAMADA.
    const nueva = await crearSolicitudCita({
        padreUsuarioId: input.padreUsuarioId,
        profesionalId: original.profesionalId,
        franjaId: input.nuevaFranjaId,
        presentacion: original.presentacion,
        urgencia: original.urgencia,
        expedienteCompartidoId: original.expedienteCompartidoId,
        porcentajeServicio: original.porcentajeServicio,
        pagoHeredadoDeId: original.id,
        solicitudPreviaId: original.id,
    });
    await withUnitOfWork(async (tx) => {
        await new SolicitudCitaRepository(tx).marcarReprogramadaOriginal(original.id);
        await new FranjaDisponibleRepository(tx).liberar(original.franjaId);
    });
    await logAudit({
        accion: "CITA_PROFESIONAL_REPROGRAMADA",
        tipoRecurso: "SolicitudCita",
        recursoId: nueva.id,
        usuarioId: input.padreUsuarioId,
        valorAnterior: JSON.stringify({ solicitudPreviaId: original.id }),
        ipAddress: "padre",
        userAgent: "cita/reprogramar",
    });
    return nueva;
}

export interface ReasignarInput {
    padreUsuarioId: string;
    solicitudId: string;
    nuevoProfesionalId: string;
    nuevaFranjaId: string;
}

export async function reasignarPorPadre(input: ReasignarInput) {
    const repo = new SolicitudCitaRepository();
    const original = await repo.findParaPadre(input.solicitudId, input.padreUsuarioId);
    if (!original) throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (original.estado !== "NO_ASISTIO_PROFESIONAL" && original.estado !== "VENCIDA_SIN_RESPUESTA") {
        throw new AppError(
            "Solo se puede reasignar cuando el profesional no llegó o no respondió",
            ERROR_CODES.VALIDATION_ERROR,
            400
        );
    }
    if (input.nuevoProfesionalId === original.profesionalId) {
        throw new AppError("Elegí OTRO profesional para reasignar", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    // Traslado de reserva: fila nueva con nuevo profesional y hereda el pago
    // (no vuelve a cobrar). La original queda como estaba (NO_ASISTIO_PROFESIONAL
    // o VENCIDA_SIN_RESPUESTA) — es el historial.
    const nueva = await crearSolicitudCita({
        padreUsuarioId: input.padreUsuarioId,
        profesionalId: input.nuevoProfesionalId,
        franjaId: input.nuevaFranjaId,
        presentacion: original.presentacion,
        urgencia: original.urgencia,
        expedienteCompartidoId: original.expedienteCompartidoId,
        porcentajeServicio: original.porcentajeServicio,
        pagoHeredadoDeId: original.id,
        solicitudPreviaId: original.id,
    });
    await logAudit({
        accion: "CITA_PROFESIONAL_REASIGNADA",
        tipoRecurso: "SolicitudCita",
        recursoId: nueva.id,
        usuarioId: input.padreUsuarioId,
        valorAnterior: JSON.stringify({ desde: original.profesionalId, hacia: input.nuevoProfesionalId }),
        ipAddress: "padre",
        userAgent: "cita/reasignar",
    });
    return nueva;
}

/**
 * Después de vencer una solicitud del profesional, evaluamos suspensión y alarma.
 * `MAX_CONSECUTIVAS_ANTES_SUSPENDER` (3) consecutivas → estado SUSPENDIDO del perfil.
 * Tasa >1/3 → alarma para IDC (audit + notificación), decisión humana.
 */
export async function evaluarSuspensionYAlarma(profesionalId: string): Promise<void> {
    const repo = new SolicitudCitaRepository();
    const perfilRepo = new PerfilProfesionalRepository();
    const consecutivas = await repo.contarConsecutivasVencidasPorProfesional(profesionalId);
    if (consecutivas >= MAX_CONSECUTIVAS_ANTES_SUSPENDER) {
        await perfilRepo.cambiarEstado(profesionalId, "SUSPENDIDO");
        await logAudit({
            accion: "CITA_PROFESIONAL_SUSPENDIDO_POR_VENCIMIENTOS",
            tipoRecurso: "PerfilProfesional",
            recursoId: profesionalId,
            valorNuevo: JSON.stringify({ consecutivas }),
            ipAddress: "worker",
            userAgent: "cita/evaluar-suspension",
        });
        return;
    }
    const { total, vencidas, tasa } = await repo.tasaVencimientos(profesionalId);
    if (total >= 3 && tasa > UMBRAL_TASA_VENCIMIENTOS) {
        await logAudit({
            accion: "CITA_PROFESIONAL_ALARMA_TASA_VENCIMIENTOS",
            tipoRecurso: "PerfilProfesional",
            recursoId: profesionalId,
            valorNuevo: JSON.stringify({ total, vencidas, tasa: Number(tasa.toFixed(2)) }),
            ipAddress: "worker",
            userAgent: "cita/evaluar-suspension",
        });
    }
}

export const CITA_PROFESIONAL_CONSTANTS = {
    HORAS_48_MS,
    PLAZO_PAGO_HORAS_DEFAULT,
    UMBRAL_TASA_VENCIMIENTOS,
    MAX_CONSECUTIVAS_ANTES_SUSPENDER,
};
