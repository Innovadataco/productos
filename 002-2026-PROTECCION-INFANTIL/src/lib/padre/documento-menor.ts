/**
 * SPEC-361 (A-70 · F8) — Reglas de la edad del menor.
 *
 * F8: en el camino se pide la EDAD (5 a 17), no el año de nacimiento — Jelkin
 * escribía el año y se equivocaba. El año guardado se DERIVA de la edad contra
 * el año en curso, así el sistema no envejece: en 2026 una edad de 17 da 2009;
 * en 2030, 2013. Nada de rangos fijos escritos a mano.
 *
 * HISTORIA: hasta SPEC-589 este archivo también validaba el documento del
 * menor (F7). El CEO ordenó quitar el documento de la ficha del hijo y las
 * columnas se eliminaron, con lo que validarDocumentoMenor/NOMBRE_DOCUMENTO
 * dejaron de tener sentido y se quitaron. El documento del PADRE (Usuario) se
 * conserva y se valida aparte (DOCUMENTO_TIPOS_PADRE en validators.ts).
 *
 * Módulo puro: lo usa la pantalla (para avisar antes de enviar) y el servidor
 * (que es quien manda). Una sola definición para las dos capas.
 */

export const EDAD_MENOR_MIN = 5;
export const EDAD_MENOR_MAX = 17;

/** Edad mínima y máxima que se ofrece al reportar (F9): el rango del producto. */
export const EDAD_REPORTE_MIN = 4;
export const EDAD_REPORTE_MAX = 17;

/** Año de nacimiento derivado de la edad, contra el año en curso (F8). */
export function anioDesdeEdad(edad: number, anioActual: number = new Date().getFullYear()): number {
    return anioActual - edad;
}

/** Edad aproximada a partir del año guardado — para volver a pintar el formulario. */
export function edadDesdeAnio(anio: number, anioActual: number = new Date().getFullYear()): number {
    return anioActual - anio;
}

/** Las edades que se ofrecen en el camino: 5 a 17, de menor a mayor. */
export function edadesMenor(): number[] {
    return Array.from({ length: EDAD_MENOR_MAX - EDAD_MENOR_MIN + 1 }, (_, i) => EDAD_MENOR_MIN + i);
}

/** Las edades que se ofrecen al reportar: 4 a 17 (F9). */
export function edadesReporte(): number[] {
    return Array.from({ length: EDAD_REPORTE_MAX - EDAD_REPORTE_MIN + 1 }, (_, i) => EDAD_REPORTE_MIN + i);
}

/** Valida la edad del menor en el camino; `null` si está bien. */
export function validarEdadMenor(edad: number | null | undefined): string | null {
    if (edad === null || edad === undefined) return null; // opcional
    if (!Number.isInteger(edad) || edad < EDAD_MENOR_MIN || edad > EDAD_MENOR_MAX) {
        return `La edad del menor debe estar entre ${EDAD_MENOR_MIN} y ${EDAD_MENOR_MAX} años.`;
    }
    return null;
}

/**
 * SPEC-372 (A-74 P4 · I-262): valida el año de nacimiento del menor en el
 * SERVIDOR. La pantalla pide edad (5-17); acá se defiende contra un POST/PATCH
 * directo con un año fuera del rango que corresponde a esa edad EL AÑO EN
 * CURSO. Sin escribir años a mano: el rango se DERIVA de EDAD_MENOR_MIN/MAX,
 * así el sistema no envejece (en 2026: 2009-2021; en 2030: 2013-2025).
 * `null` si está bien; `null` también cuando llega vacío (el campo es opcional
 * en el schema y no cambia con esta validación).
 */
export function validarAnioNacimientoMenor(
    anio: number | null | undefined,
    anioActual: number = new Date().getFullYear()
): string | null {
    if (anio === null || anio === undefined) return null;
    if (!Number.isInteger(anio)) {
        return "El año de nacimiento del menor debe ser un número entero.";
    }
    const anioMin = anioActual - EDAD_MENOR_MAX;
    const anioMax = anioActual - EDAD_MENOR_MIN;
    if (anio < anioMin || anio > anioMax) {
        return `La edad del menor debe estar entre ${EDAD_MENOR_MIN} y ${EDAD_MENOR_MAX} años.`;
    }
    return null;
}
