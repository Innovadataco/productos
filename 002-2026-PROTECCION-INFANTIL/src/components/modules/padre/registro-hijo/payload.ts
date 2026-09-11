/**
 * SPEC-601 · Payload compartido del alta de hijo entre las dos variantes de UI
 * (wizard de SPEC-599 en /dashboard/padre/hijos y formulario inline restaurado
 * del camino /camino/hijos). Un solo lugar arma el body del POST
 * /api/padre/hijos: contrato intacto desde SPEC-589 (sin documento).
 */
/** Identificador aún no guardado: se acumula en el formulario de alta. */
export type IdentificadorNuevo = { valor: string; plataformaId: string };

/**
 * Datos ya validados del menor; `anioNacimiento: null` = sin especificar.
 * SPEC-627 (D-134): la fuente es el AÑO DE NACIMIENTO (durable), no la edad
 * (que se congela). El contrato del POST ya era `anioNacimiento` (SPEC-372);
 * antes se derivaba de la edad, ahora llega directo del formulario.
 */
export type DatosAltaHijo = {
    nombre: string;
    apellidos: string;
    anioNacimiento: number | null;
    sexo: string;
};

export function construirPayloadAltaHijo(
    datos: DatosAltaHijo,
    identificadores: IdentificadorNuevo[],
): Record<string, unknown> {
    return {
        nombre: datos.nombre,
        apellidos: datos.apellidos,
        ...(datos.anioNacimiento !== null ? { anioNacimiento: datos.anioNacimiento } : {}),
        ...(datos.sexo ? { sexo: datos.sexo } : {}),
        ...(identificadores.length
            ? {
                identificadores: identificadores.map((i) => ({
                    valor: i.valor,
                    ...(i.plataformaId ? { plataformaId: i.plataformaId } : {}),
                })),
            }
            : {}),
    };
}
