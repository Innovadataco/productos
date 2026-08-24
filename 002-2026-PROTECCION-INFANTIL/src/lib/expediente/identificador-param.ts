/**
 * SPEC-233 (002-PI-133): decodificación y validación del parámetro [nick]
 * de las rutas `/dashboard/<ambito>/identificador/[nick]`.
 * Nunca se ejecuta una búsqueda con el valor crudo sin decodificar.
 */

export const MAX_IDENTIFICADOR_LENGTH = 100;

/**
 * Decodifica el parámetro de ruta. Si el valor ya viene decodificado por el
 * framework (o contiene `%` literales), devuelve el valor tal cual.
 */
export function decodificarIdentificadorParam(raw: string): string {
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

/** Válido: no vacío y máx 100 caracteres tras decodificar. */
export function esIdentificadorParamValido(identificador: string): boolean {
    return identificador.length > 0 && identificador.length <= MAX_IDENTIFICADOR_LENGTH;
}
