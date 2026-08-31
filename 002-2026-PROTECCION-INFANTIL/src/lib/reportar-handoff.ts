/**
 * Traspaso del identificador hacia /reportar.
 *
 * El identificador NO puede viajar en la URL (spec 091-US2 / 093-US4: ni href,
 * ni router.push, ni query string — lo vigila `url-privacy.test.ts`). Una URL
 * queda en el historial del navegador, en el `Referer` y en los logs del
 * servidor; sessionStorage no sale de la pestaña.
 *
 * Dos pantallas dejan un identificador acá y las dos quieren cosas distintas:
 * - /seguimiento (SPEC-324): `fijar: true` — el padre viene a agregar un evento
 *   sobre ESE identificador, así que el campo queda de solo lectura.
 * - la consulta vacía (F3 N-5): `fijar: false` — es un prellenado de cortesía y
 *   el usuario puede corregirlo.
 *
 * La llave es de un solo uso: `tomarHandoffReportar` lee y borra.
 */
export const REPORTAR_STORAGE_KEY = "reportar.identificador";

/** Mismo límite que el esquema de la API (`identificador` máx. 100 chars). */
const MAX_IDENTIFICADOR = 100;

export type ReportarHandoff = {
    identificador: string;
    /** true = el campo queda de solo lectura en el wizard. */
    fijar: boolean;
};

export function dejarHandoffReportar(identificador: string, opciones: { fijar: boolean }): void {
    if (typeof window === "undefined") return;
    const payload: ReportarHandoff = {
        identificador: identificador.slice(0, MAX_IDENTIFICADOR),
        fijar: opciones.fijar,
    };
    sessionStorage.setItem(REPORTAR_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Lee el handoff y lo borra. Devuelve `null` si no hay nada o si lo guardado no
 * es lo que esperamos (basura de una versión vieja o manipulada a mano): en ese
 * caso el wizard simplemente arranca vacío.
 */
export function tomarHandoffReportar(): ReportarHandoff | null {
    if (typeof window === "undefined") return null;
    const crudo = sessionStorage.getItem(REPORTAR_STORAGE_KEY);
    if (!crudo) return null;
    sessionStorage.removeItem(REPORTAR_STORAGE_KEY);
    try {
        const parsed: unknown = JSON.parse(crudo);
        if (typeof parsed !== "object" || parsed === null) return null;
        const { identificador, fijar } = parsed as Partial<ReportarHandoff>;
        if (typeof identificador !== "string" || identificador === "") return null;
        return { identificador: identificador.slice(0, MAX_IDENTIFICADOR), fijar: fijar === true };
    } catch {
        return null;
    }
}
