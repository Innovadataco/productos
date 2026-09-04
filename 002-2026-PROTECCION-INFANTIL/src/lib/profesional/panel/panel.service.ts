/**
 * SPEC-425 (A-75 · L5) · El inicio del profesional.
 *
 * Arma de una sola vez lo que el panel muestra. **No hay lógica de negocio
 * nueva acá**: el motor de citas es de L4 y este módulo solo lee, agrupa y
 * cuenta. Si algo no se puede hacer todavía, se dice — no se inventa.
 *
 * ## Las dos reglas del brief que se hacen cumplir acá
 *
 *  1. **§3 · el marcador NO cuenta las citas `SIN_CONFIRMAR`.** Ni en familias
 *     atendidas ni en lo que se gira. Se muestran aparte, como lo que son:
 *     solicitudes que el profesional todavía no respondió.
 *  2. **§9 · los expedientes compartidos son de SOLO LECTURA** y se abren con
 *     el código que el padre entrega en la sesión. El panel los **lista**;
 *     no los abre ni expone su contenido.
 *
 * ## Lo que este lote NO hace, a propósito
 *
 * El §7 del brief pone **el cierre en L6** y **la plata en L7**. Por eso
 * «casos por cerrar» se **lista** pero no se cierra, y «por cobrar» muestra lo
 * retenido sin poder girarlo. Nada en `src/` escribe hoy `CUMPLIDA` ni
 * `NO_ASISTIO_PADRE`: el panel refleja esa realidad en vez de pintar un botón
 * que no hace nada.
 */
import type { EstadoSolicitudCita } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { VerificadorRepository } from "@/lib/dal/repositories/verificador-repository";
import { desglosarTarifa, PORCENTAJE_SERVICIO_DEFAULT, type DesgloseTarifa } from "../cita/comision";

/** Estados que esperan una respuesta del profesional dentro de las 48 h. */
const ESPERAN_RESPUESTA: EstadoSolicitudCita[] = ["SIN_CONFIRMAR", "PAGADA_PENDIENTE"];

/** Estados que YA fueron atendidos por el profesional y cuentan en el marcador. */
const CUENTAN_EN_EL_MARCADOR: EstadoSolicitudCita[] = ["CONFIRMADA", "CUMPLIDA", "NO_ASISTIO_PADRE"];

/** Estados cuyo pago está retenido esperando el cierre (L6/L7). */
const RETIENEN_PAGO: EstadoSolicitudCita[] = ["CONFIRMADA"];

export interface SolicitudPanelDto {
    id: string;
    padreNombre: string;
    /** Cuándo pidió la cita. */
    pedidaEn: string;
    inicio: string;
    modalidad: string;
    /** `pagoAprobadoEn + 48h`. `null` mientras el admin no aprueba el pago. */
    venceEnRespuesta: string | null;
    /** El reloj de 48 h ya arrancó (el pago está aprobado). */
    reservaPagada: boolean;
    /** El padre le compartió el expediente de su hijo (solo lectura). */
    compartioExpediente: boolean;
}

export interface CitaAgendaDto {
    id: string;
    padreNombre: string;
    inicio: string;
    modalidad: string;
}

export interface CasoPorCerrarDto extends CitaAgendaDto {
    /** Lo que se le libera al profesional cuando se pueda cerrar (L6). */
    montoRetenido: number;
}

export interface MarcadorDto {
    familiasAtendidas: number;
    solicitudesRecibidas: number;
    /** No suma al marcador — brief §3. Se muestra para que sepa qué le falta. */
    sinConfirmar: number;
}

export interface VerificacionPanelDto {
    alDia: boolean;
    revisadaEn: string;
    venceEn: string;
    diasParaVencer: number;
}

export interface ExpedienteCompartidoDto {
    solicitudId: string;
    padreNombre: string;
}

export interface PanelProfesionalDto {
    nombreVisible: string;
    solicitudes: SolicitudPanelDto[];
    casosPorCerrar: CasoPorCerrarDto[];
    citasConfirmadas: CitaAgendaDto[];
    porCobrar: {
        /** Suma retenida de las citas que esperan cierre. */
        montoRetenido: number;
        citasEsperandoCierre: number;
        desglose: DesgloseTarifa;
    };
    marcador: MarcadorDto;
    verificacion: VerificacionPanelDto | null;
    expedientesCompartidos: ExpedienteCompartidoDto[];
}

const DIA_MS = 24 * 60 * 60 * 1000;
const HORAS_48_MS = 48 * 60 * 60 * 1000;

/** Un caso está «por cerrar» cuando ya se confirmó y su hora ya pasó. */
function yaOcurrio(inicio: Date, ahora: Date): boolean {
    return inicio.getTime() <= ahora.getTime();
}

export async function panelDelProfesional(
    usuarioId: string,
    ahora: Date = new Date(),
): Promise<PanelProfesionalDto> {
    const perfil = await new VerificadorRepository().findPorUsuarioId(usuarioId);
    if (!perfil) {
        throw new AppError("Perfil profesional no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }

    const repo = new SolicitudCitaRepository();
    const solicitudes = await repo.listarPorProfesional(perfil.id);

    const esperandoRespuesta = solicitudes.filter((s) => ESPERAN_RESPUESTA.includes(s.estado));
    const confirmadas = solicitudes.filter((s) => s.estado === "CONFIRMADA");
    const porCerrar = confirmadas.filter((s) => yaOcurrio(s.franja.inicio, ahora));
    const agenda = confirmadas.filter((s) => !yaOcurrio(s.franja.inicio, ahora));

    // El porcentaje que se le cobró de verdad manda sobre el default: una
    // solicitud vieja conserva el suyo aunque el número global cambie.
    const porcentaje = solicitudes[0]?.porcentajeServicio ?? PORCENTAJE_SERVICIO_DEFAULT;

    const retenidas = solicitudes.filter((s) => RETIENEN_PAGO.includes(s.estado));

    // Los tres números del marcador se cuentan en la base: `listarPorProfesional`
    // trae como mucho 100 filas y a partir de ahí el contador mentiría en
    // silencio. Brief §3: las SIN_CONFIRMAR no suman a lo atendido.
    const [familiasAtendidas, solicitudesRecibidas, sinConfirmar] = await Promise.all([
        repo.contarFamiliasAtendidas(perfil.id, CUENTAN_EN_EL_MARCADOR),
        repo.contarPorProfesional(perfil.id),
        repo.contarPorProfesional(perfil.id, ESPERAN_RESPUESTA),
    ]);
    const marcador: MarcadorDto = { familiasAtendidas, solicitudesRecibidas, sinConfirmar };

    return {
        nombreVisible: perfil.nombreVisible,
        solicitudes: esperandoRespuesta.map((s) => ({
            id: s.id,
            padreNombre: s.padreUsuario.nombre ?? "Una familia",
            pedidaEn: s.creadoEn.toISOString(),
            inicio: s.franja.inicio.toISOString(),
            modalidad: s.franja.modalidad,
            venceEnRespuesta: s.pagoAprobadoEn
                ? new Date(s.pagoAprobadoEn.getTime() + HORAS_48_MS).toISOString()
                : null,
            reservaPagada: s.pagoAprobadoEn !== null,
            compartioExpediente: s.expedienteCompartidoId !== null,
        })),
        casosPorCerrar: porCerrar.map((s) => ({
            id: s.id,
            padreNombre: s.padreUsuario.nombre ?? "Una familia",
            inicio: s.franja.inicio.toISOString(),
            modalidad: s.franja.modalidad,
            montoRetenido: s.montoConsulta,
        })),
        citasConfirmadas: agenda
            .slice()
            .sort((a, b) => a.franja.inicio.getTime() - b.franja.inicio.getTime())
            .map((s) => ({
                id: s.id,
                padreNombre: s.padreUsuario.nombre ?? "Una familia",
                inicio: s.franja.inicio.toISOString(),
                modalidad: s.franja.modalidad,
            })),
        porCobrar: {
            montoRetenido: retenidas.reduce((suma, s) => suma + s.montoConsulta, 0),
            citasEsperandoCierre: retenidas.length,
            desglose: desglosarTarifa(perfil.tarifaConsultaCOP, porcentaje),
        },
        marcador,
        verificacion: construirVerificacion(perfil.verificaciones[0], ahora),
        // §9: solo se LISTAN. El contenido se abre con el código que el padre
        // entrega en la sesión, y este panel no lo pide ni lo guarda.
        expedientesCompartidos: solicitudes
            .filter((s) => s.expedienteCompartidoId !== null)
            .map((s) => ({
                solicitudId: s.id,
                padreNombre: s.padreUsuario.nombre ?? "Una familia",
            })),
    };
}

function construirVerificacion(
    ultima: { revisadoEn: Date; venceEn: Date } | undefined,
    ahora: Date,
): VerificacionPanelDto | null {
    if (!ultima) return null;
    const diasParaVencer = Math.ceil((ultima.venceEn.getTime() - ahora.getTime()) / DIA_MS);
    return {
        alDia: diasParaVencer > 0,
        revisadaEn: ultima.revisadoEn.toISOString(),
        venceEn: ultima.venceEn.toISOString(),
        diasParaVencer,
    };
}
