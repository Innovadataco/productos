/**
 * SPEC-590 — cambios de perfil del padre: detección y etiquetas legibles.
 *
 * El PATCH /api/padre/perfil audita cada campo modificado (AccionAudit
 * PERFIL_CAMBIO, valorAnterior/valorNuevo JSON `{campo, valor}`) y el endpoint
 * GET /api/padre/perfil/auditoria los sirve con su etiqueta humana. Este helper
 * es la fuente única del mapa campo→etiqueta para ambas capas (si la UI
 * inventara sus propias etiquetas, servidor y pantalla podrían divergir).
 */

/** Campos del perfil del padre que se auditan, con su nombre legible. */
export const ETIQUETAS_CAMPO_PERFIL: Record<string, string> = {
    email: "Correo electrónico",
    nombre: "Nombres",
    apellidos: "Apellidos",
    documentoTipo: "Tipo de documento",
    documentoNumero: "Número de documento",
    fechaNacimiento: "Fecha de nacimiento",
    telefono: "Teléfono",
    paisId: "País",
    ciudadId: "Ciudad",
};

/**
 * Devuelve los campos que realmente cambian comparando el payload del PATCH
 * contra el valor actual. Normaliza fechas a `YYYY-MM-DD` para comparar lo que
 * el formulario envía contra lo que la BD devuelve.
 */
export function detectarCambiosPerfil(
    actual: Record<string, unknown>,
    entrada: Record<string, unknown>
): { campo: string; anterior: string | null; nuevo: string | null }[] {
    const cambios: { campo: string; anterior: string | null; nuevo: string | null }[] = [];
    for (const [campo, nuevoBruto] of Object.entries(entrada)) {
        if (!(campo in ETIQUETAS_CAMPO_PERFIL)) continue;
        if (nuevoBruto === undefined) continue;
        const anteriorBruto = actual[campo];
        const anterior = normalizarValor(campo, anteriorBruto);
        const nuevo = normalizarValor(campo, nuevoBruto);
        if (anterior === nuevo) continue;
        cambios.push({ campo, anterior, nuevo });
    }
    return cambios;
}

function normalizarValor(campo: string, valor: unknown): string | null {
    if (valor === null || valor === undefined || valor === "") return null;
    if (campo === "fechaNacimiento") {
        // BD devuelve Date; el formulario envía "YYYY-MM-DD".
        if (valor instanceof Date) return valor.toISOString().slice(0, 10);
        return String(valor).slice(0, 10);
    }
    return String(valor);
}
