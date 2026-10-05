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
import { contactoVisiblePorSesion } from "./contacto-visible";
import { derivarEnlaceParaCita, type EnlaceParaCita } from "./enlace-derivado";

const HORAS_48_EN_MS = 48 * 60 * 60 * 1000;

/**
 * SPEC-758 · Reserva por NOMBRE de los campos de ENLACE de la cita (dictamen D-121).
 *
 * `enlaceReunion` es dato sensible de ACCESO a una sesión con un menor; `enlaceOperadorId`
 * y `enlacePublicadoEn` son metadatos operativos. NINGUNO sale por los DTOs que ve el padre
 * (`toCitaParaPadre`) o el profesional (`toCitaParaProfesional`). Se vigila por NOMBRE desde
 * YA —antes de que exista el lector (el consumidor va en SPEC-750)— para que ese PR no pueda
 * colar el enlace a un DTO sin romper el candado (`dto-reserva.candado.test.ts`). Mismo patrón
 * que `CAMPOS_INTERNOS_PROFESIONAL` con `direccionAtencion` (#665). Cuando SPEC-750 exponga el
 * enlace, lo hará de forma DERIVADA y gateada, quitándolo de esta lista a conciencia.
 */
export const CAMPOS_INTERNOS_CITA = [
    "enlaceReunion",
    "enlaceOperadorId",
    "enlacePublicadoEn",
] as const;

/**
 * @internal — expuesta para el test candado. SPEC-754: el contacto está CERRADO (la fuente
 * `contactoVisiblePorSesion` es `false`) y la excepción de reembolso MIGRÓ a la PQR (SPEC-752).
 * `_now`/`pagoAprobadoEn` quedan en la firma por compatibilidad de llamadores; ya no deciden.
 */
export function debeExponerContacto(
    solicitud: Pick<SolicitudCita, "estado" | "pagoAprobadoEn">,
    _now: Date,
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
    // SPEC-449 (I-313 · I-315): PI no puede seguir sirviendo el teléfono de
    // alguien de quien **ya decidió** que no debe estar atendiendo. Manda sobre
    // cualquier excepción de abajo, incluida la cita confirmada.
    //
    //  · `VENCIDO` — se le cumplió el plazo de la Ley 2375/2024 y quedó escrito
    //    en la auditoría. Seguir entregando su contacto es contradecir lo que
    //    el propio sistema registró que sabía.
    //  · `SUSPENDIDO` — **más grave todavía**: PI decidió que no debe estar
    //    atendiendo. Hoy lo pone el worker de forma AUTOMÁTICA (solicitudes
    //    vencidas seguidas — `cita.service.ts`; SPEC-692 lo dejó apagable y con
    //    salida de administrador). NO es una decisión humana. Igual que
    //    VENCIDO, seguir dándole el teléfono contradice esa decisión (I-315).
    //
    // La lista es explícita a propósito: un `!== "ACTIVO"` cerraría también
    // estados de tránsito como `EN_REVISION`, y eso es otra decisión que nadie
    // tomó.
    if (estadoPerfil === "VENCIDO" || estadoPerfil === "SUSPENDIDO") return false;
    // La visibilidad la decide la fuente única `contactoVisiblePorSesion` (hoy `false`, SPEC-754):
    // el contacto está cerrado; el canal de la reunión es el enlace de la cita.
    if (contactoVisiblePorSesion(solicitud.estado)) return true;
    // SPEC-754 · D-1: la excepción de REEMBOLSO (`VENCIDA_SIN_RESPUESTA` + 48h) se RETIRÓ — MIGRÓ a
    // la PQR (SPEC-752, motivo 2 «Un pago o un cobro»). NO sobra: un reembolso es asunto padre↔PI
    // (la plata la tiene PI), y la reversión corre con plazos contados DESDE el reclamo (padre 5
    // hábiles, PI 15 hábiles); un correo directo no deja constancia de CUÁNDO, la PQR sí.
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
    /**
     * SPEC-778 · estado del ENLACE de la reunión (derivado, fuente única `enlace-derivado`).
     * SOLO presente en citas CONFIRMADA. La `url` viaja únicamente en estado PUBLICADO.
     */
    enlace?: EnlaceParaCita;
    /** Historial mínimo para el padre: si es una reprogramación, apunta a la previa. */
    solicitudPreviaId: string | null;
    /** Si heredó pago, indica de dónde (para que el padre no dude si le van a cobrar). */
    pagoHeredadoDeId: string | null;
    /**
     * SPEC-715: el caso que esta cita comparte con el profesional (si el padre lo
     * vinculó al agendar). Es el expediente del PROPIO padre — se le expone para
     * que genere el «pase» desde la cita (los 8 caracteres que le dicta al
     * profesional en la sesión). `null` = la cita no quedó atada a un caso.
     */
    expedienteCompartidoId: string | null;
    /**
     * SPEC-864 · Si el padre YA reportó «el profesional no cumplió» sobre ESTA cita y la PQR
     * sigue ABIERTA, su número de seguimiento; si no, `null`. Es el PROPIO rastro del padre (su
     * PQR), no dato de terceros — por eso puede salir. La pantalla lo usa para mostrar «ya nos
     * avisaste» y ESCONDER el disparador (no se radica dos veces, FORMA §2.5).
     *
     * OPT-IN: solo lo puebla el loader del DETALLE de la cita (que sí consulta la PQR abierta);
     * las demás consultas no lo traen y queda `undefined` (la pantalla lo trata igual que `null`).
     * No ensancha ninguna consulta por defecto.
     */
    peticionCitaAbierta?: { numeroSeguimiento: string } | null;
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

/**
 * SPEC-864 · Datos EXTRA que solo el loader del detalle resuelve y pasa aparte (no viven en la
 * `SolicitudCita`). Hoy: la PQR abierta del padre sobre esta cita. Opcional a propósito — los 7
 * llamadores que no lo pasan dejan el campo `undefined`, equivalente a «no hay».
 */
export interface OpcionesCitaParaPadre {
    peticionCitaAbierta?: { numeroSeguimiento: string } | null;
}

export function toCitaParaPadre(
    solicitud: SolicitudConRelaciones,
    now: Date = new Date(),
    opts?: OpcionesCitaParaPadre
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
        expedienteCompartidoId: solicitud.expedienteCompartidoId,
        // SPEC-864: el loader del detalle lo resuelve; el resto deja `undefined` (= sin reporte).
        peticionCitaAbierta: opts?.peticionCitaAbierta ?? null,
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
    // SPEC-778: el enlace de la reunión (derivado, gateado). Solo para CONFIRMADA — en otros
    // estados no hay reunión viva. La `url` sale únicamente en PUBLICADO (nunca cruda por nombre).
    if (solicitud.estado === "CONFIRMADA") {
        base.enlace = derivarEnlaceParaCita(
            {
                estado: solicitud.estado,
                enlaceReunion: solicitud.enlaceReunion,
                enlacePublicadoEn: solicitud.enlacePublicadoEn,
                franjaInicio: solicitud.franja.inicio,
                franjaFin: solicitud.franja.fin,
            },
            now,
        );
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
    /**
     * SPEC-778 · estado del ENLACE de la reunión (misma fuente única que el padre).
     * SOLO presente en CONFIRMADA. La `url` viaja únicamente en PUBLICADO.
     */
    enlace?: EnlaceParaCita;
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
    // Simétrico: al profesional se le da el correo del padre por la misma regla de sesión
    // (fuente única `contactoVisiblePorSesion`). Antes, el sistema mediador es PI.
    if (contactoVisiblePorSesion(solicitud.estado)) {
        dto.padre.email = solicitud.padreUsuario.email;
    }
    // SPEC-778: el enlace de la reunión, misma derivación que el padre (solo CONFIRMADA).
    if (solicitud.estado === "CONFIRMADA") {
        dto.enlace = derivarEnlaceParaCita(
            {
                estado: solicitud.estado,
                enlaceReunion: solicitud.enlaceReunion,
                enlacePublicadoEn: solicitud.enlacePublicadoEn,
                franjaInicio: solicitud.franja.inicio,
                franjaFin: solicitud.franja.fin,
            },
            now,
        );
    }
    return dto;
}
