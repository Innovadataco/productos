/**
 * SPEC-954 (UX alta colegio · Jelkin vivo, prod e3d0f98f) — FUENTE ÚNICA del
 * rango de años de nacimiento de un ADULTO (profesor/rector), para que la UI
 * (selector) y la red de seguridad del servidor no deriven.
 *
 * El rango de negocio es de EDAD (18 a 80 años), no de año: el año válido se
 * deriva del año en curso. SPEC-442 (I-307) ya fijó este rango; antes el
 * `<input type="number">` libre dejaba teclear «2000888888» y el usuario solo
 * se enteraba al enviar. El selector lo vuelve ESTRUCTURALMENTE imposible
 * (imposibilidad estructural > regla); el schema sigue siendo la red de seguridad.
 *
 * Las edades 18 y 80 viven ACÁ y en NINGÚN otro lado: el schema
 * (`src/lib/schemas/identidad.ts`) y el candado del selector las importan.
 */

// Edad mínima/máxima de un adulto que se da de alta (profesor/rector).
export const EDAD_MIN_ADULTO = 18;
export const EDAD_MAX_ADULTO = 80;

/**
 * Rango de AÑOS de nacimiento válidos, derivado del año en curso.
 * `ahora` es inyectable para los tests (no depende del reloj real).
 */
export function rangoAnioNacimientoAdulto(ahora: number = new Date().getFullYear()): {
    minAnio: number;
    maxAnio: number;
} {
    return { minAnio: ahora - EDAD_MAX_ADULTO, maxAnio: ahora - EDAD_MIN_ADULTO };
}

/**
 * Años de nacimiento ofrecibles, en orden DESCENDENTE (el más reciente arriba).
 * Nunca incluye un año fuera de [ahora−80, ahora−18].
 */
export function aniosNacimientoAdulto(ahora: number = new Date().getFullYear()): number[] {
    const { minAnio, maxAnio } = rangoAnioNacimientoAdulto(ahora);
    const anios: number[] = [];
    for (let anio = maxAnio; anio >= minAnio; anio--) anios.push(anio);
    return anios;
}
