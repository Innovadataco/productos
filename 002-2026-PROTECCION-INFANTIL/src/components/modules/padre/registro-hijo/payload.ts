/**
 * SPEC-601 · Payload compartido del alta de hijo entre las dos variantes de UI
 * (wizard de SPEC-599 en /dashboard/padre/hijos y formulario inline restaurado
 * del camino /camino/hijos). Un solo lugar arma el body del POST
 * /api/padre/hijos: contrato intacto desde SPEC-589 (sin documento).
 */
import { anioDesdeEdad } from "@/lib/padre/documento-menor";

/** Identificador aún no guardado: se acumula en el formulario de alta. */
export type IdentificadorNuevo = { valor: string; plataformaId: string };

/** Datos ya validados del menor; `edad: null` = sin especificar. */
export type DatosAltaHijo = {
    nombre: string;
    apellidos: string;
    edad: number | null;
    sexo: string;
};

export function construirPayloadAltaHijo(
    datos: DatosAltaHijo,
    identificadores: IdentificadorNuevo[],
): Record<string, unknown> {
    return {
        nombre: datos.nombre,
        apellidos: datos.apellidos,
        ...(datos.edad !== null ? { anioNacimiento: anioDesdeEdad(datos.edad) } : {}),
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
