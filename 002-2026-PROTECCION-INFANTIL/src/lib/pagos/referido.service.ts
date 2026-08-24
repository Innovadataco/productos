/**
 * SPEC-215 (002-PI-115): servicio del programa de referidos del módulo de pagos.
 *
 * - Generación de códigos únicos `PI-<TIPO>-<HASH8>` (FR-001..FR-003).
 * - Aplicación de un código ajeno con validaciones de integridad (FR-004..FR-006):
 *   código activo, anti-autorreferido por suscripción/colegio/usuario/email
 *   (Decisión 2: Usuario no tiene documento — se usa email), duplicado
 *   (referidor, referida) y tope anual de exitosos en año calendario Bogotá (FR-009).
 * - Recompensas al autorizar el primer pago del referido (hook `pago.autorizado`,
 *   FR-007): activación del uso, descuento del referido si aún no se calculó y
 *   1 mes gratis al referidor como extensión de vigencia (Decisión 3).
 * - Aviso del N-ésimo uso activado del año (`referido.tope_anual`, FR-008/US-006).
 *
 * Toda la persistencia pasa por repositorios DAL (`PagosRepository` +
 * `PagosReferidosRepository`, FR-011). Los eventos se emiten
 * vía el motor de notificaciones (SPEC-201) en modo fail-open: una falla del motor
 * nunca revienta el flujo de negocio.
 */
import { EstadoSuscripcion } from "@prisma/client";
import type { TipoTitular } from "@prisma/client";
import { addMonths } from "date-fns";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { PagosReferidosRepository } from "@/lib/dal/repositories/pagos-referidos-repository";
import { programar } from "@/lib/notificaciones/motor";
import { generarCodigoReferido } from "@/lib/utils/referido-codigo";
import { anioBogota } from "./renovacion-calculos";
import {
    obtenerDescuentoReferidoPct,
    obtenerMaxReferidosPorAnio,
    obtenerReferidosNotificarAdminAl,
} from "./parametros-pagos";
import { verificarTitularidad, type UsuarioTitular } from "./suscripcion-vista.service";

export const EVENTOS_REFERIDO = {
    REGISTRADO: "referido.registrado",
    RECOMPENSA_OTORGADA: "referido.recompensa.otorgada",
    TOPE_ANUAL: "referido.tope_anual",
} as const;

const MAX_INTENTOS_CODIGO = 5;

type SuscripcionConTitular = NonNullable<Awaited<ReturnType<PagosReferidosRepository["obtenerSuscripcionConTitular"]>>>;

function redondear2(valor: number): number {
    return Math.round(valor * 100) / 100;
}

/**
 * Genera un código de referido garantizando unicidad contra
 * `Suscripcion.codigoReferidoPropio` (reintento con nuevo hash si colisiona, FR-003).
 */
export async function generarCodigoReferidoUnico(
    tipoTitular: TipoTitular,
    repo: PagosReferidosRepository = new PagosReferidosRepository()
): Promise<string> {
    for (let intento = 1; intento <= MAX_INTENTOS_CODIGO; intento++) {
        const codigo = generarCodigoReferido(tipoTitular);
        if (!(await repo.existeCodigoReferidoPropio(codigo))) {
            return codigo;
        }
        console.warn(`[Referidos] Generación de código: colisión — ${codigo}; reintento ${intento}`);
    }
    throw new AppError("No se pudo generar un código de referido único", ERROR_CODES.INTERNAL_ERROR, 500);
}

/** Email de contacto del titular de una suscripción (padre, admin del colegio o representante legal). */
function emailTitular(s: SuscripcionConTitular): string | null {
    return s.usuario?.email ?? s.colegio?.admin?.email ?? s.colegio?.representanteLegalEmail ?? null;
}

function resolverDestinatariosTitular(s: SuscripcionConTitular, variables: Record<string, unknown>) {
    if (s.usuario) {
        return [{ usuarioId: s.usuario.id, variables: { nombre: s.usuario.nombre ?? "", ...variables } }];
    }
    if (s.colegio?.admin) {
        return [
            {
                usuarioId: s.colegio.admin.id,
                variables: { nombre: s.colegio.admin.nombre ?? s.colegio.nombre, ...variables },
            },
        ];
    }
    if (s.colegio?.representanteLegalEmail) {
        return [
            {
                email: s.colegio.representanteLegalEmail,
                variables: { nombre: s.colegio.representanteLegalNombre || s.colegio.nombre, ...variables },
            },
        ];
    }
    return [];
}

/** Emisión fail-open al motor de notificaciones (mismo patrón que el worker de vigencia). */
async function emitirEventoReferido(
    evento: string,
    s: SuscripcionConTitular,
    variables: Record<string, unknown>,
    extraDestinatarios: Array<{ email: string; variables: Record<string, unknown> }> = []
): Promise<void> {
    const destinatarios = [...resolverDestinatariosTitular(s, variables), ...extraDestinatarios];
    if (destinatarios.length === 0) {
        console.warn(`[Referidos] ${evento}: ${s.id} — sin destinatario conocido; notificación omitida`);
        return;
    }
    try {
        await programar({ evento, sujetoTipo: "Suscripcion", sujetoId: s.id, destinatarios });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Referidos] ${evento}: ${s.id} — motor de notificaciones no disponible (${msg}); se continúa`);
    }
}

export interface AplicarReferidoInput {
    suscripcionId: string;
    codigoReferido: string;
    usuario: UsuarioTitular & { email: string };
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface AplicarReferidoResultado {
    usoId: string;
    codigoReferido: string;
    referidorId: string;
    descuentoPrimerPagoPct: number;
    estado: "REGISTRADO";
}

/**
 * Aplica un código de referido a la suscripción del cliente autenticado
 * (registro o renovación). Contrato: `contracts/215-referidos.md`.
 */
export async function aplicarCodigoReferido(input: AplicarReferidoInput): Promise<AplicarReferidoResultado> {
    const repo = new PagosRepository();
    const refRepo = new PagosReferidosRepository();
    const codigo = input.codigoReferido.trim().toUpperCase();

    const propia = await verificarTitularidad(input.suscripcionId, input.usuario);
    if (!propia) {
        throw new AppError("Suscripción no encontrada o no pertenece al usuario", ERROR_CODES.NOT_FOUND, 404);
    }

    // FR-005: el código existe y pertenece a una suscripción ACTIVA o EN_GRACIA.
    const referidor = await refRepo.obtenerSuscripcionPorCodigoReferido(codigo);
    if (!referidor || (referidor.estado !== EstadoSuscripcion.ACTIVA && referidor.estado !== EstadoSuscripcion.EN_GRACIA)) {
        throw new AppError("Código no encontrado o inactivo", "referido_invalido", 409);
    }

    // FR-005: anti-autorreferido (mismo titular por suscripción, colegio, usuario o email).
    const emailReferido = input.usuario.email.trim().toLowerCase();
    const emailReferidor = emailTitular(referidor)?.trim().toLowerCase() ?? null;
    const esAutorreferido =
        referidor.id === propia.id ||
        (propia.colegioId !== null && referidor.colegioId === propia.colegioId) ||
        (propia.usuarioId !== null && referidor.usuarioId === propia.usuarioId) ||
        (emailReferidor !== null && emailReferidor === emailReferido);
    if (esAutorreferido) {
        throw new AppError("No puedes usar tu propio código", "referido_autorreferido", 409);
    }

    // FR-005: duplicado (referidor, referida).
    const duplicado = await refRepo.buscarUsoReferido(referidor.id, propia.id);
    if (duplicado) {
        throw new AppError("Ya fuiste referido por este usuario", "referido_ya_registrado", 409);
    }

    // FR-005/FR-009: tope anual de referidos exitosos en año calendario Bogotá.
    const anio = anioBogota();
    const maxPorAnio = await obtenerMaxReferidosPorAnio();
    const exitosos = await repo.contarReferidosExitososPorAnio(referidor.id, anio);
    if (exitosos >= maxPorAnio) {
        throw new AppError("El referidor llegó al tope anual", "referido_tope_anual", 409);
    }

    // FR-006: registro del uso + evento.
    const uso = await repo.crearCodigoReferidoUso({
        codigoReferidoUsuarioId: referidor.id,
        suscripcionReferidaId: propia.id,
        anio,
    });

    // FR-010: auditoría del uso (sin datos personales del referido, solo ids).
    await logAudit({
        accion: "REFERIDO_REGISTRADO",
        tipoRecurso: "CodigoReferidoUso",
        recursoId: uso.id,
        usuarioId: input.usuario.id,
        colegioId: propia.colegioId ?? undefined,
        valorNuevo: JSON.stringify({
            codigoReferido: codigo,
            referidorId: referidor.id,
            suscripcionReferidaId: propia.id,
            anio,
        }),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
    });

    await emitirEventoReferido(EVENTOS_REFERIDO.REGISTRADO, referidor, { codigoReferido: codigo, anio });

    const descuentoPrimerPagoPct = await obtenerDescuentoReferidoPct();
    console.warn(`[Referidos] Aplicación de código: registrada — ${codigo} ${propia.id}`);
    return {
        usoId: uso.id,
        codigoReferido: codigo,
        referidorId: referidor.id,
        descuentoPrimerPagoPct,
        estado: "REGISTRADO",
    };
}

export interface RecompensaReferidoResumen {
    usoId: string;
    recompensaOtorgada: boolean;
    descuentoAplicadoUSD: number;
    notificadoTopeAnual: boolean;
}

/**
 * Hook del evento interno `pago.autorizado` (FR-007): si la suscripción del pago
 * tiene un `CodigoReferidoUso` pendiente de activación, lo activa, aplica el
 * descuento del referido sobre el pago (si aún no se calculó), otorga 1 mes
 * gratis al referidor (extensión de vigencia, Decisión 3), emite los eventos
 * `referido.recompensa.otorgada` / `referido.tope_anual` y audita (FR-008, FR-010).
 *
 * Lo invoca el endpoint admin de autorización de pagos (SPEC-212). Devuelve null
 * cuando el pago no existe o la suscripción no fue referida.
 */
export async function procesarRecompensasPagoAutorizado(
    pagoId: string,
    actorAdminId: string
): Promise<RecompensaReferidoResumen | null> {
    const repo = new PagosRepository();
    const refRepo = new PagosReferidosRepository();
    const pago = await repo.obtenerPagoPorId(pagoId);
    if (!pago) return null;
    const uso = await refRepo.obtenerUsoReferidoPendiente(pago.suscripcionId);
    if (!uso) return null;

    const referidor = await refRepo.obtenerSuscripcionConTitular(uso.codigoReferidoUsuarioId);
    const ahora = new Date();

    // 1. Activación del uso.
    await refRepo.actualizarCodigoReferidoUso(uso.id, { fechaActivacion: ahora });

    // 2. Descuento del referido sobre su pago, solo si aún no se calculó
    //    (el flujo de renovación de SPEC-211 ya lo aplica cuando el código viene en el formulario).
    let descuentoAplicadoUSD = 0;
    const pct = await obtenerDescuentoReferidoPct();
    if (!pago.codigoReferidoUsado && referidor && pct > 0) {
        descuentoAplicadoUSD = redondear2((pago.montoBaseUSD * pct) / 100);
        const montoNetoUSD = Math.max(0, redondear2(pago.montoNetoUSD - descuentoAplicadoUSD));
        await repo.actualizarPago(pago.id, {
            descuentoAplicadoUSD: redondear2(pago.descuentoAplicadoUSD + descuentoAplicadoUSD),
            montoNetoUSD,
            montoLocalPagado: redondear2(montoNetoUSD * pago.tasaCambioAplicada),
            codigoReferidoUsado: referidor.codigoReferidoPropio,
        });
    }

    // 3. Recompensa del referidor: 1 mes gratis como extensión de vigencia.
    //    AS-005: si el tope anual se alcanzó entre el registro y la activación,
    //    el uso queda activado pero sin recompensa (revisión manual).
    let recompensaOtorgada = false;
    if (referidor && (referidor.estado === EstadoSuscripcion.ACTIVA || referidor.estado === EstadoSuscripcion.EN_GRACIA)) {
        const exitosos = await repo.contarReferidosExitososPorAnio(referidor.id, uso.anio);
        const maxPorAnio = await obtenerMaxReferidosPorAnio();
        if (exitosos < maxPorAnio) {
            await repo.actualizarSuscripcion(referidor.id, { fechaFin: addMonths(referidor.fechaFin, 1) });
            await refRepo.actualizarCodigoReferidoUso(uso.id, {
                recompensaOtorgada: true,
                recompensaOtorgadaEn: ahora,
                tipoRecompensa: "MES_GRATIS_REFERIDOR",
            });
            recompensaOtorgada = true;
        } else {
            await refRepo.actualizarCodigoReferidoUso(uso.id, { requiereRevisionAdmin: true });
            console.warn(
                `[Referidos] Recompensa: diferida por tope anual — ${referidor.codigoReferidoPropio} ${referidor.id}`
            );
        }
    } else if (referidor) {
        await refRepo.actualizarCodigoReferidoUso(uso.id, { requiereRevisionAdmin: true });
        console.warn(
            `[Referidos] Recompensa: referidor en estado ${referidor.estado} — ${referidor.codigoReferidoPropio} ${referidor.id}; revisión manual`
        );
    }

    // 4. N-ésimo uso activado del año: marca revisión de admin (US-006) y emite
    //    `referido.tope_anual` al referidor y a los admins de plataforma (FR-008).
    let notificadoTopeAnual = false;
    if (referidor) {
        const activados = await refRepo.contarUsosReferidosActivadosPorAnio(referidor.id, uso.anio);
        const notificarAl = await obtenerReferidosNotificarAdminAl();
        if (activados === notificarAl) {
            await refRepo.actualizarCodigoReferidoUso(uso.id, { requiereRevisionAdmin: true });
            const admins = await refRepo.listarEmailsAdminActivos();
            const variables = { codigoReferido: referidor.codigoReferidoPropio, usosAnio: activados };
            await emitirEventoReferido(
                EVENTOS_REFERIDO.TOPE_ANUAL,
                referidor,
                variables,
                admins.map((a) => ({ email: a.email, variables }))
            );
            notificadoTopeAnual = true;
        }
    }

    // 5. Evento + auditoría de la recompensa.
    if (recompensaOtorgada && referidor) {
        await emitirEventoReferido(EVENTOS_REFERIDO.RECOMPENSA_OTORGADA, referidor, {
            codigoReferido: referidor.codigoReferidoPropio,
        });
    }
    await logAudit({
        accion: "REFERIDO_RECOMPENSA_OTORGADA",
        tipoRecurso: "CodigoReferidoUso",
        recursoId: uso.id,
        usuarioId: actorAdminId,
        valorNuevo: JSON.stringify({
            pagoId: pago.id,
            suscripcionReferidaId: pago.suscripcionId,
            referidorId: uso.codigoReferidoUsuarioId,
            recompensaOtorgada,
            descuentoAplicadoUSD,
            notificadoTopeAnual,
        }),
        ipAddress: "job",
        userAgent: "hook-pago-autorizado",
    });
    console.warn(
        `[Referidos] Recompensa al autorizar pago: ${recompensaOtorgada ? "otorgada" : "no otorgada"} — ` +
            `${referidor?.codigoReferidoPropio ?? "desconocido"} ${uso.codigoReferidoUsuarioId}`
    );

    return { usoId: uso.id, recompensaOtorgada, descuentoAplicadoUSD, notificadoTopeAnual };
}
