/**
 * SPEC-750 · Calendario del OPERADOR — MISMA pantalla del profesional, DTO PROPIO
 * que NO puede cargar PII del padre.
 *
 * EL INNEGOCIABLE (FORMA §3, [NORMA] Ley 1581 · minimización): el operador es
 * logística, no atención. `BloqueCalendario` del profesional trae `familia` (nombre
 * del padre), `relato` (`presentacion`) y `contactoEmail`. Acá el DTO ni siquiera
 * tiene esas propiedades y la query NO selecciona `padreUsuario` — imposibilidad
 * ESTRUCTURAL, no un `omit` en el render. El candado `calendario-operador.reserva`
 * lo prueba con los tres campos poblados en la fuente.
 *
 * El operador SÍ ve el campo del enlace (lo publica); lo que nunca ve es al padre.
 */
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE_BOGOTA, diaBogota } from "@/lib/fechas/formato-bogota";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";

const DIA_MS = 24 * 60 * 60 * 1000;

export interface BloqueSesionOperador {
    /** id de la cita (`SolicitudCita`). */
    citaId: string;
    /** primeros 8 chars, para mostrar sin volcar el cuid completo. */
    citaRef: string;
    /** Fecha calendario Bogotá `yyyy-MM-dd`. */
    fecha: string;
    minInicio: number;
    minFin: number;
    inicioISO: string;
    finISO: string;
    modalidad: string;
    /** Nombre visible del profesional (dato público, no PII del padre). */
    profesionalNombre: string;
    /** Estado del enlace, derivado: sin publicar / publicado. NO trae PII. */
    enlaceEstado: "sin-enlace" | "publicado";
    /** El enlace lo gestiona el operador; se le muestra para saber si ya lo pegó. */
    enlaceReunion: string | null;
}

export interface CalendarioOperadorDto {
    hoy: string;
    bloques: BloqueSesionOperador[];
}

function minutosBogota(d: Date): number {
    const [h, m] = formatInTimeZone(d, TIMEZONE_BOGOTA, "HH:mm").split(":").map(Number);
    return h * 60 + m;
}

/**
 * Las sesiones asignadas a ESTE operador (por `enlaceOperadorId`). La query lleva un
 * `select` explícito: **no** incluye `padreUsuario`, así el nombre/relato/correo del
 * padre no pueden llegar al DTO (estructural).
 */
export async function calendarioDelOperador(
    usuarioId: string,
    ahora: Date = new Date(),
): Promise<CalendarioOperadorDto> {
    const desde = new Date(ahora.getTime() - 2 * DIA_MS);
    const hasta = new Date(ahora.getTime() + 120 * DIA_MS);

    // La query vive en el repo (Q-3) con `select` SIN `padreUsuario` (imposibilidad estructural).
    const citas = await new SolicitudCitaRepository().listarSesionesDeOperador(usuarioId, desde, hasta);

    const bloques: BloqueSesionOperador[] = citas.map((c) => ({
        citaId: c.id,
        citaRef: c.id.slice(0, 8),
        fecha: diaBogota(c.franja.inicio),
        minInicio: minutosBogota(c.franja.inicio),
        minFin: minutosBogota(c.franja.fin),
        inicioISO: c.franja.inicio.toISOString(),
        finISO: c.franja.fin.toISOString(),
        modalidad: c.franja.modalidad,
        profesionalNombre: c.profesional.nombreVisible,
        enlaceEstado: c.enlacePublicadoEn ? "publicado" : "sin-enlace",
        enlaceReunion: c.enlaceReunion,
    }));

    return { hoy: diaBogota(ahora), bloques };
}
