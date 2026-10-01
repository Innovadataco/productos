/**
 * SPEC-778 · FUENTE ÚNICA de «qué ve el usuario del enlace de la reunión».
 *
 * El enlace de la cita (`SolicitudCita.enlaceReunion`) lo publica el operador (SPEC-750);
 * el padre y el profesional necesitan ENTRAR a la reunión, pero hoy ninguno lo ve. Esta
 * derivación es la única que decide el ESTADO del enlace y si sale la `url`; la consumen
 * las TRES superficies (`toCitaParaPadre`, `toCitaParaProfesional`, `BloqueCalendario`),
 * como `contacto-visible` centraliza el contacto. Es import-light (sin infra) para que el
 * candado la pruebe como unit.
 *
 * Dos disciplinas del CEO, escritas en el código:
 *  · Condición 1 — UNA sola noción de tiempo: «¿pasó la hora?» sale de `estadoEfectivoDeCita`
 *    (SPEC-746), NUNCA de una comparación `now < franjaFin` nueva. (`enlaceVisibleParaCita`
 *    de 750, que duplicaba esa frontera y no tenía llamadores, se ELIMINÓ en esta SPEC.)
 *  · Condición 2 — el estado no miente sin reloj: el ESTADO de publicación es un HECHO DE
 *    DATOS (no necesita el reloj); solo la `url` y la fase PASADA lo necesitan. Si `now`
 *    falta o es basura, cae a INDETERMINADO: sin `url` (fail-closed) y SIN afirmar que la
 *    hora pasó ni que el operador no actuó. La validez del reloj se detecta con
 *    `relojUtilizable` (746), no con una comprobación paralela.
 *
 * El enlace es acceso a la sesión de un MENOR: la `url` sale SOLO en PUBLICADO, nunca a
 * `AuditLog.metadatos` (BI), nunca por correo, y el render la escapa (nunca HTML).
 */
import type { EstadoSolicitudCita } from "@prisma/client";
import { estadoEfectivoDeCita, relojUtilizable, type EntradaTiempo } from "./estado-efectivo";

/**
 * Los estados que ve el usuario. PASADA = la vista «ya pasó» (FR-2) toma el relevo.
 * SPEC-792 C4: `PASADA_SIN_PUBLICAR` distingue el sub-caso en que el enlace NUNCA se publicó al pasar
 * la hora — el padre esperó siguiendo nuestra instrucción y el acceso jamás llegó. Es una falla NUESTRA,
 * no suya; la pantalla lo reconoce sin culpar al operador (no se expone `enlacePublicadoEn`, solo el estado).
 */
export type EstadoEnlaceCita = "SIN_PUBLICAR" | "PUBLICADO" | "PASADA" | "PASADA_SIN_PUBLICAR" | "INDETERMINADO";

export interface EnlaceParaCita {
    estado: EstadoEnlaceCita;
    /** SOLO presente en PUBLICADO. Acceso a la sesión de un menor: no sale en ningún otro estado. */
    url?: string;
}

/** Lo mínimo que la derivación necesita de la cita (lo tienen las tres superficies). */
export interface CitaParaEnlace {
    estado: EstadoSolicitudCita;
    enlaceReunion: string | null;
    enlacePublicadoEn: EntradaTiempo;
    franjaInicio: EntradaTiempo;
    franjaFin: EntradaTiempo;
}

export function derivarEnlaceParaCita(cita: CitaParaEnlace, now: EntradaTiempo): EnlaceParaCita {
    // El enlace solo aplica a la reunión de una cita CONFIRMADA. En otros estados
    // (CUMPLIDA/VENCIDA/…) no hay reunión viva: sin url. Las superficies no pintan el
    // bloque en esos casos; devolvemos un estado seguro igual.
    if (cita.estado !== "CONFIRMADA") return { estado: "SIN_PUBLICAR" };

    // Condición 2: sin reloj no se afirma nada del tiempo. INDETERMINADO = sin url, sin mentir.
    if (!relojUtilizable(now)) return { estado: "INDETERMINADO" };

    // Condición 1: la fase temporal viene de la fuente única (746). Para CONFIRMADA es
    // PROXIMA / EN_CURSO / PASADA.
    const fase = estadoEfectivoDeCita("CONFIRMADA", cita.franjaInicio, cita.franjaFin, now);
    if (fase === "PASADA") {
        // SPEC-792 C4: ¿el acceso llegó a estar disponible antes de pasar la hora? Si NUNCA se publicó,
        // es un sub-estado honesto: la falla fue nuestra, no del padre. Si sí se publicó, «ya pasó» normal.
        const seHabiaPublicado = cita.enlacePublicadoEn != null && cita.enlaceReunion != null;
        return { estado: seHabiaPublicado ? "PASADA" : "PASADA_SIN_PUBLICAR" };
    }

    // Viva (PROXIMA/EN_CURSO): el ESTADO lo decide la PUBLICACIÓN (hecho de datos). Exigimos
    // AMBOS —marca de publicación y url— para no pintar nunca «PUBLICADO» sin enlace real.
    const publicado = cita.enlacePublicadoEn != null && cita.enlaceReunion != null;
    if (!publicado) return { estado: "SIN_PUBLICAR" };
    return { estado: "PUBLICADO", url: cita.enlaceReunion! };
}
