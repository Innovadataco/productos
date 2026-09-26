/**
 * SPEC-740 (bug de Jelkin · pérdida de datos al autorizar) — el registro del
 * profesional como asistente multi-paso, ESPEJO del camino del padre (SPEC-339).
 *
 * Por qué existe: hoy el registro es una sola pantalla (`/perfil-profesional/completar`)
 * con la ficha en estado de cliente VOLÁTIL; ir a aceptar la autorización (otra página)
 * la desmonta y, al volver (navegación dura tras «Acepto»), la ficha se re-lee del
 * servidor VACÍA — se pierde todo lo digitado. El wizard lo mata: **cada paso GUARDA al
 * avanzar** (PUT borrador) y **recarga al entrar**; «Atrás» solo NAVEGA, no borra.
 *
 * A diferencia del padre/colegio, el profesional NO está en la máquina de cookie/
 * middleware del camino: lo gatea `guardia-habilitado` (servidor, por estado). Así que
 * este registro es SOLO el registro de pasos para la UI (indicador «Paso N de N» +
 * Siguiente/Atrás) — cero acoplamiento a Edge/cookie. La fuente de la verdad del avance
 * es el estado del perfil en la base, no una cookie.
 *
 * Orden PROVISIONAL (Diseño confirma): 1 Ficha → 2 Documentos → 3 Autorización.
 * Voz: usted (profesional, D-107).
 */

/** Los pasos del registro del profesional, en orden. */
export const PASOS_PROFESIONAL = ["ficha", "documentos", "autorizacion"] as const;

export type PasoProfesional = (typeof PASOS_PROFESIONAL)[number];

/** Raíz de las pantallas del registro del profesional. */
export const RAIZ_PROFESIONAL = "/perfil-profesional";

interface DefinicionPasoProfesional {
    /** Posición humana: "Paso N de 3". */
    readonly numero: 1 | 2 | 3;
    /** Pantalla del paso. */
    readonly destino: string;
    /** Título corto del indicador de progreso. */
    readonly titulo: string;
}

export const DEFINICION_PASOS_PROFESIONAL: Readonly<Record<PasoProfesional, DefinicionPasoProfesional>> = {
    ficha: { numero: 1, destino: `${RAIZ_PROFESIONAL}/completar`, titulo: "Su ficha" },
    documentos: { numero: 2, destino: `${RAIZ_PROFESIONAL}/documentos`, titulo: "Sus documentos" },
    autorizacion: { numero: 3, destino: `${RAIZ_PROFESIONAL}/autorizacion`, titulo: "Autorización" },
};

export const TOTAL_PASOS_PROFESIONAL = PASOS_PROFESIONAL.length;

/** Destino de un paso. */
export function destinoDePasoProfesional(paso: PasoProfesional): string {
    return DEFINICION_PASOS_PROFESIONAL[paso].destino;
}

/** El paso ANTERIOR (para «Atrás»); null en el paso 1. */
export function pasoAnteriorProfesional(paso: PasoProfesional): PasoProfesional | null {
    const i = PASOS_PROFESIONAL.indexOf(paso);
    return i > 0 ? PASOS_PROFESIONAL[i - 1]! : null;
}

/** El paso SIGUIENTE (para «Siguiente»); null en el último. */
export function pasoSiguienteProfesional(paso: PasoProfesional): PasoProfesional | null {
    const i = PASOS_PROFESIONAL.indexOf(paso);
    return i >= 0 && i < PASOS_PROFESIONAL.length - 1 ? PASOS_PROFESIONAL[i + 1]! : null;
}

/** El paso cuyo `destino` corresponde a este pathname (o null si no es del wizard). */
export function pasoDeRuta(pathname: string | null): PasoProfesional | null {
    if (!pathname) return null;
    for (const paso of PASOS_PROFESIONAL) {
        const destino = DEFINICION_PASOS_PROFESIONAL[paso].destino;
        if (pathname === destino || pathname.startsWith(destino + "/")) return paso;
    }
    return null;
}
