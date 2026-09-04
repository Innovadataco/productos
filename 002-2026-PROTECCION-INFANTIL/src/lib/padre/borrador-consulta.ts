/**
 * SPEC-440 (I-306 · Jelkin vivo 04-09) — el borrador de la consulta del
 * padre (presentación + urgencia) NUNCA viaja en la URL. Antes iba como
 * `?u=ESTA_SEMANA&pres=Soy+Jelkin+…+2+hijos+de+14+y+16+años` — nombre
 * completo y edades de los menores en la barra de direcciones, historial
 * del navegador, logs del servidor y cabecera `referer` de cada request
 * que salga de esa pantalla. Regla de la casa: **datos personales van en
 * cuerpo o en estado de sesión; nunca en la URL**.
 *
 * Este helper es la fuente única del borrador. `sessionStorage` es la
 * elección mínima: sobrevive recargas y navegación dentro de la pestaña,
 * muere al cerrarla, no se comparte con otras pestañas ni queda en logs.
 * Todo acceso es tolerante a fallos (Safari privado, política de sitio,
 * ambientes SSR): `null` cuando no se puede leer, no-op cuando no se
 * puede escribir.
 */
const CLAVE = "padre.consulta.borrador";

export type UrgenciaBorrador = "ESTA_SEMANA" | "SIN_APURO";

export interface BorradorConsulta {
    presentacion: string;
    urgencia: UrgenciaBorrador;
}

export function leerBorradorConsulta(): BorradorConsulta | null {
    if (typeof window === "undefined") return null;
    try {
        const crudo = window.sessionStorage.getItem(CLAVE);
        if (!crudo) return null;
        const dato = JSON.parse(crudo) as Partial<BorradorConsulta>;
        if (typeof dato?.presentacion !== "string") return null;
        if (dato.urgencia !== "ESTA_SEMANA" && dato.urgencia !== "SIN_APURO") return null;
        return { presentacion: dato.presentacion, urgencia: dato.urgencia };
    } catch {
        // sessionStorage puede lanzar por política del sitio o cuota; no
        // hacemos ruido — el padre completa el form vacío en ese caso.
        return null;
    }
}

export function guardarBorradorConsulta(borrador: BorradorConsulta): void {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(CLAVE, JSON.stringify(borrador));
    } catch {
        // Cuota agotada o storage bloqueado: sin acción; el flujo sigue.
    }
}

export function borrarBorradorConsulta(): void {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.removeItem(CLAVE);
    } catch {
        // Sin acción.
    }
}
