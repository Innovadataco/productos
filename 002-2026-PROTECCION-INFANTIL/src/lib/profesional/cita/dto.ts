/**
 * SPEC-395 (L4) · DTOs de la cita profesional.
 *
 * CANDADO CRÍTICO (brief §3 · veredicto CEO 09:50 · «lo escribimos en el
 * código, no solo en el test»):
 *
 *   El TELÉFONO y el CORREO del profesional NO salen por ninguna API antes
 *   de que la cita esté confirmada. Si el contacto viaja en un JSON, el padre
 *   llama por fuera, PI no ve nada y se cae la plata y la métrica.
 *
 * Cuándo SÍ sale el contacto (excepciones explícitas):
 *   · Estado `CONFIRMADA` — la cita ya arrancó su vida, el padre necesita
 *     contactar al profesional para coordinar.
 *   · Estado `VENCIDA_SIN_RESPUESTA` con `pagoAprobadoEn + 48h` ya pasado —
 *     el profesional dejó vencer el plazo, se le devuelve todo al padre y
 *     se le abre el contacto directo (brief §3, aviso CEO 09:50).
 *
 * `debeExponerContacto` centraliza la decisión: los DTOs la llaman y el test
 * la afirma en los tres estados (sin confirmar → sin contacto; confirmada →
 * con contacto; vencida-48h → con contacto).
 */
import type {
    EstadoSolicitudCita,
    PerfilProfesional,
    SolicitudCita,
    Usuario,
} from "@prisma/client";

const HORAS_48_EN_MS = 48 * 60 * 60 * 1000;

/**
 * @internal — expuesta para el test candado.
 * `now` inyectable para deterministismo en tests.
 */
export function debeExponerContacto(
    solicitud: Pick<SolicitudCita, "estado" | "pagoAprobadoEn">,
    now: Date,
    /**
     * SPEC-449 · estado del PERFIL del profesional. **REQUERIDO a propósito.**
     *
     * Nació opcional «para no romper llamadores». Eso es exactamente el punto
     * blando: hoy hay un solo llamador y lo pasa, pero **el próximo que se
     * olvide vuelve a exponer el teléfono de un profesional vencido, y ningún
     * test lo vería**. Esto es reserva legal (H-2 · Ley 2375/2024), así que el
     * compilador tiene que exigirlo — no la memoria de quien escriba el código.
     */
    estadoPerfil: PerfilProfesional["estado"] | null
): boolean {
    // SPEC-449 (I-313): PI no puede seguir sirviendo el teléfono de alguien de
    // quien YA ESCRIBIÓ EN SU PROPIA AUDITORÍA que la verificación venció. Esa
    // contradicción —saberlo y seguir entregándolo— es lo que no se defiende
    // ante un tercero. Manda sobre cualquier excepción de abajo.
    if (estadoPerfil === "VENCIDO") return false;
    if (solicitud.estado === "CONFIRMADA") return true;
    if (solicitud.estado === "VENCIDA_SIN_RESPUESTA") {
        if (!solicitud.pagoAprobadoEn) return false;
        return now.getTime() - solicitud.pagoAprobadoEn.getTime() >= HORAS_48_EN_MS;
    }
    return false;
}

export interface ContactoProfesionalDto {
    email: string;
    telefono: string | null;
}

export interface CitaParaPadreDto {
    id: string;
    estado: EstadoSolicitudCita;
    urgencia: SolicitudCita["urgencia"];
    creadoEn: string;
    venceEn: string;
    pagoAprobadoEn: string | null;
    montoTotal: number;
    profesional: {
        id: string;
        nombreVisible: string;
        tituloProfesional: string;
        ciudad: { id: string; nombre: string };
    };
    franja: { inicio: string; fin: string; modalidad: SolicitudCita["urgencia"] extends never ? never : string };
    /** SOLO presente cuando `debeExponerContacto` es true. */
    contactoProfesional?: ContactoProfesionalDto;
    /** Historial mínimo para el padre: si es una reprogramación, apunta a la previa. */
    solicitudPreviaId: string | null;
    /** Si heredó pago, indica de dónde (para que el padre no dude si le van a cobrar). */
    pagoHeredadoDeId: string | null;
}

type PerfilConCiudadYUsuario = PerfilProfesional & {
    ciudad: { id: string; nombre: string };
    usuario: Pick<Usuario, "email" | "telefono">;
};

type FranjaMin = { inicio: Date; fin: Date; modalidad: string };

type SolicitudConRelaciones = SolicitudCita & {
    profesional: PerfilConCiudadYUsuario;
    franja: FranjaMin;
};

export function toCitaParaPadre(
    solicitud: SolicitudConRelaciones,
    now: Date = new Date()
): CitaParaPadreDto {
    const base: CitaParaPadreDto = {
        id: solicitud.id,
        estado: solicitud.estado,
        urgencia: solicitud.urgencia,
        creadoEn: solicitud.creadoEn.toISOString(),
        venceEn: solicitud.venceEn.toISOString(),
        pagoAprobadoEn: solicitud.pagoAprobadoEn?.toISOString() ?? null,
        montoTotal: solicitud.montoTotal,
        profesional: {
            id: solicitud.profesional.id,
            nombreVisible: solicitud.profesional.nombreVisible,
            tituloProfesional: solicitud.profesional.tituloProfesional,
            ciudad: solicitud.profesional.ciudad,
        },
        franja: {
            inicio: solicitud.franja.inicio.toISOString(),
            fin: solicitud.franja.fin.toISOString(),
            modalidad: solicitud.franja.modalidad,
        },
        solicitudPreviaId: solicitud.solicitudPreviaId,
        pagoHeredadoDeId: solicitud.pagoHeredadoDeId,
    };
    // SPEC-449: el estado del PERFIL entra en la decisión. `solicitud.profesional`
    // ya es un `PerfilProfesional` completo, así que el dato está a mano y no
    // hace falta ensanchar ninguna consulta.
    if (debeExponerContacto(solicitud, now, solicitud.profesional.estado)) {
        base.contactoProfesional = {
            email: solicitud.profesional.usuario.email,
            telefono: solicitud.profesional.usuario.telefono,
        };
    }
    return base;
}

/** DTO que ve el profesional de una solicitud propia — presentación del padre
 *  + expediente compartido, si aplica. El correo del padre solo sale cuando la
 *  cita está confirmada (excepción simétrica del candado). */
export interface CitaParaProfesionalDto {
    id: string;
    estado: EstadoSolicitudCita;
    urgencia: SolicitudCita["urgencia"];
    creadoEn: string;
    venceEnRespuesta: string | null; // pagoAprobadoEn + 48h, si aplica
    presentacion: string;
    padre: { id: string; nombre: string | null; email?: string };
    franja: { inicio: string; fin: string; modalidad: string };
    expedienteCompartidoId: string | null;
    montoConsulta: number;
}

type SolicitudParaProfesional = SolicitudCita & {
    padreUsuario: Pick<Usuario, "id" | "nombre" | "email">;
    franja: FranjaMin;
};

export function toCitaParaProfesional(
    solicitud: SolicitudParaProfesional,
    now: Date = new Date()
): CitaParaProfesionalDto {
    const venceEnRespuesta = solicitud.pagoAprobadoEn
        ? new Date(solicitud.pagoAprobadoEn.getTime() + HORAS_48_EN_MS).toISOString()
        : null;
    const dto: CitaParaProfesionalDto = {
        id: solicitud.id,
        estado: solicitud.estado,
        urgencia: solicitud.urgencia,
        creadoEn: solicitud.creadoEn.toISOString(),
        venceEnRespuesta,
        presentacion: solicitud.presentacion,
        padre: { id: solicitud.padreUsuario.id, nombre: solicitud.padreUsuario.nombre },
        franja: {
            inicio: solicitud.franja.inicio.toISOString(),
            fin: solicitud.franja.fin.toISOString(),
            modalidad: solicitud.franja.modalidad,
        },
        expedienteCompartidoId: solicitud.expedienteCompartidoId,
        montoConsulta: solicitud.montoConsulta,
    };
    // Simétrico: al profesional se le da el correo del padre solo si la cita
    // está confirmada. Antes, el sistema mediador es PI.
    if (solicitud.estado === "CONFIRMADA") {
        dto.padre.email = solicitud.padreUsuario.email;
    }
    // Suprimir la fecha absoluta de vencimiento hasta que el reloj arranque.
    if (!solicitud.pagoAprobadoEn) {
        // no-op: ya se dejó null explícito arriba
    }
    void now;
    return dto;
}
