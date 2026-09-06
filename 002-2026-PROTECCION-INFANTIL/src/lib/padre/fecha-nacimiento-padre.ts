/**
 * SPEC-541 (P2) · validación de la fecha de nacimiento del PADRE.
 *
 * Antes el esquema solo miraba el FORMATO (YYYY-MM-DD), así que aceptaba 1900 y
 * fechas futuras. Un padre es un adulto: la edad válida es de 18 a 100 años, y la
 * fecha no puede estar en el futuro. Se calcula en UTC para casar con cómo se
 * guarda (`new Date(`${fecha}T00:00:00.000Z`)`).
 */
export const EDAD_MIN_PADRE = 18;
export const EDAD_MAX_PADRE = 100;

/** Edad cumplida en años enteros entre `nacimiento` y `ref`, en UTC. */
export function edadEnAniosUTC(nacimiento: Date, ref: Date): number {
    let edad = ref.getUTCFullYear() - nacimiento.getUTCFullYear();
    const mes = ref.getUTCMonth() - nacimiento.getUTCMonth();
    const yaCumplio = mes > 0 || (mes === 0 && ref.getUTCDate() >= nacimiento.getUTCDate());
    if (!yaCumplio) edad -= 1;
    return edad;
}

/**
 * Devuelve un mensaje de error si la fecha (YYYY-MM-DD) no es válida para un padre,
 * o `null` si está bien. Vigila los DOS bordes (18 y 100) y el futuro.
 */
export function validarFechaNacimientoPadre(fecha: string, ref: Date = new Date()): string | null {
    const nacimiento = new Date(`${fecha}T00:00:00.000Z`);
    if (Number.isNaN(nacimiento.getTime())) return "Fecha de nacimiento inválida.";
    if (nacimiento.getTime() > ref.getTime()) return "La fecha de nacimiento no puede ser una fecha futura.";
    const edad = edadEnAniosUTC(nacimiento, ref);
    if (edad < EDAD_MIN_PADRE) return `Debes tener al menos ${EDAD_MIN_PADRE} años.`;
    if (edad > EDAD_MAX_PADRE) return `La edad no puede superar los ${EDAD_MAX_PADRE} años.`;
    return null;
}
