/**
 * SPEC-714 · La lectura que alimenta el calendario nivel dios.
 *
 * Un SOLO componente (Calendario para publicar, Citaciones para responder) se
 * pinta desde este DTO. Une cada `FranjaDisponible` con su reserva
 * (`SolicitudCita`) y deriva el ESTADO del bloque —lo que el profesional ve en
 * la cuadrícula— del estado real de la cita (SPEC-712), no de un flag suelto:
 *
 *   sin reserva            → `libre`       (cielo · publicar/quitar/repetir)
 *   SIN_CONFIRMAR          → `validando`   (neutro · sin acción: validando el pago)
 *   PAGADA_PENDIENTE       → `esperando`   (ámbar · Confirmar / No puedo, con el relato)
 *   CONFIRMADA             → `confirmada`  (pino · detalle: contacto, sin código de cierre)
 *   otro (tomada)          → `reservada`   (bloqueado, a prueba de borrado)
 *
 * Reserva legal H-2: el correo del padre solo sale en `CONFIRMADA` — el mismo
 * criterio que `toCitaParaProfesional`. El relato (`presentacion`) se muestra
 * para poder responder; nunca `checklist`/`resultado` de la verificación.
 *
 * Los tiempos se proyectan a **America/Bogota** aquí (fecha + minutos del día),
 * para que la cuadrícula no tenga que hacer zona horaria: el servidor manda la
 * verdad ya en la hora del usuario (D-69).
 */
import { formatInTimeZone } from "date-fns-tz";
import type { EstadoSolicitudCita } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { DiaBloqueadoRepository } from "@/lib/dal/repositories/dia-bloqueado";
import { TIMEZONE_BOGOTA, diaBogota } from "@/lib/fechas/formato-bogota";

export type EstadoBloque = "libre" | "validando" | "esperando" | "confirmada" | "reservada";

export interface BloqueCalendario {
    /** id de la franja. */
    id: string;
    /** Fecha calendario en Bogotá, `yyyy-MM-dd`. */
    fecha: string;
    /** Minutos desde medianoche (Bogotá). */
    minInicio: number;
    minFin: number;
    /** ISO en UTC — para acciones que necesitan el instante absoluto. */
    inicioISO: string;
    finISO: string;
    modalidad: "VIRTUAL" | "PRESENCIAL";
    estado: EstadoBloque;
    /** Solo en bloques con reserva. */
    solicitudId?: string;
    familia?: string;
    /** El relato de la familia — solo en `esperando` (para responder). */
    relato?: string;
    /** Correo del padre — solo en `confirmada` (H-2). */
    contactoEmail?: string;
}

export interface CalendarioProfesionalDto {
    /** Hoy en Bogotá (`yyyy-MM-dd`) — para resaltar el día y abrir en la semana en curso. */
    hoy: string;
    bloques: BloqueCalendario[];
    /** Muro de vigencia (ISO UTC) — ninguna franja puede terminar después. `null` = sin verificación aprobada. */
    venceEn: string | null;
    /**
     * El muro proyectado a Bogotá (`fecha` + `minuto` del día), para pintar la zona
     * rayada y pre-chequear sin zona horaria en la pantalla (D-69): la pantalla solo
     * compara fechas/minutos. `null` = sin verificación aprobada.
     */
    muro: { fecha: string; minuto: number } | null;
    /** Días cerrados por el profesional (`yyyy-MM-dd` Bogotá) — modelo `DiaBloqueado`. El rayado durable es el reflejo de la fila. */
    diasBloqueados: string[];
    atiendeVirtual: boolean;
    atiendePresencial: boolean;
    duracionMinutos: number;
}

const DIA_MS = 24 * 60 * 60 * 1000;

// El «día Bogotá» (yyyy-MM-dd) viene de una sola verdad: `diaBogota` (SPEC-714/Datos).
const fechaBogota = diaBogota;
function minutosBogota(d: Date): number {
    const [h, m] = formatInTimeZone(d, TIMEZONE_BOGOTA, "HH:mm").split(":").map(Number);
    return h * 60 + m;
}

function estadoBloque(tomada: boolean, estadoCita: EstadoSolicitudCita | undefined): EstadoBloque {
    if (!tomada || !estadoCita) return "libre";
    if (estadoCita === "SIN_CONFIRMAR") return "validando";
    if (estadoCita === "PAGADA_PENDIENTE") return "esperando";
    if (estadoCita === "CONFIRMADA") return "confirmada";
    // Terminal o cualquier otro estado con la franja tomada: bloqueado, a prueba de borrado.
    return "reservada";
}

/**
 * El calendario del profesional para una ventana amplia (desde el inicio de esta
 * semana hasta la vigencia). El componente filtra la semana/día visible en el
 * cliente; se sobre-lee unos días hacia atrás a propósito para que la semana en
 * curso venga completa sin calcular el lunes exacto en la consulta.
 */
export async function calendarioDelProfesional(
    usuarioId: string,
    ahora: Date = new Date(),
): Promise<CalendarioProfesionalDto> {
    const perfilRepo = new PerfilProfesionalRepository();
    const perfil = await perfilRepo.findPorUsuarioId(usuarioId);
    if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);

    const venceEn = await perfilRepo.venceEnVigente(perfil.id);
    const desde = new Date(ahora.getTime() - 8 * DIA_MS);
    const hasta = venceEn ? new Date(venceEn.getTime() + DIA_MS) : new Date(ahora.getTime() + 120 * DIA_MS);

    const [franjas, diasBloqueados] = await Promise.all([
        new FranjaDisponibleRepository().listarConSolicitud(perfil.id, desde, hasta),
        new DiaBloqueadoRepository().diasBloqueadosDe(perfil.id),
    ]);

    const bloques: BloqueCalendario[] = franjas.map((f) => {
        const estado = estadoBloque(f.tomada, f.solicitud?.estado);
        const bloque: BloqueCalendario = {
            id: f.id,
            fecha: fechaBogota(f.inicio),
            minInicio: minutosBogota(f.inicio),
            minFin: minutosBogota(f.fin),
            inicioISO: f.inicio.toISOString(),
            finISO: f.fin.toISOString(),
            modalidad: f.modalidad,
            estado,
        };
        if (f.solicitud) {
            bloque.solicitudId = f.solicitud.id;
            bloque.familia = f.solicitud.padreUsuario.nombre ?? "Una familia";
            if (estado === "esperando") bloque.relato = f.solicitud.presentacion;
            // H-2: el correo del padre solo cuando la cita está CONFIRMADA.
            if (estado === "confirmada" && f.solicitud.padreUsuario.email) {
                bloque.contactoEmail = f.solicitud.padreUsuario.email;
            }
        }
        return bloque;
    });

    return {
        hoy: fechaBogota(ahora),
        bloques,
        venceEn: venceEn ? venceEn.toISOString() : null,
        muro: venceEn ? { fecha: fechaBogota(venceEn), minuto: minutosBogota(venceEn) } : null,
        diasBloqueados, // SPEC-714 · días cerrados por el profesional (modelo DiaBloqueado, Datos).
        atiendeVirtual: perfil.atiendeVirtual,
        atiendePresencial: perfil.atiendePresencial,
        duracionMinutos: perfil.duracionMinutos,
    };
}
