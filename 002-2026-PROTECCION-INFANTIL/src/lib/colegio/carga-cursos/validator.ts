/**
 * SPEC-379 (PR B · D5a) — Validador de la carga por Excel de CURSOS.
 *
 * Clasifica cada fila del parser en `crear` | `omitido` | `error`:
 *   · error: falta nombre / grado inválido / año inválido / profesor titular
 *     no existe en el colegio.
 *   · omitido: (nombre, grado, año) ya existe en el colegio o está duplicado
 *     en el mismo archivo (sería el mismo curso).
 *   · crear: todo bien, listo para el importer.
 *
 * Grados válidos: 1..11 (misma lista que `GRADO_OPTIONS` de la UI). El año
 * lectivo se acepta como texto libre 4 dígitos entre 1900 y `anioActual+2`
 * — el rector puede planear un año adelante.
 */
import type { FilaCurso } from "./parser";

const GRADOS_VALIDOS = Array.from({ length: 11 }, (_, i) => String(i + 1));

export interface CursoNormalizado {
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
    profesorTitularId: string | null;
}

export type FilaClasificada =
    | { estado: "crear"; linea: number; curso: CursoNormalizado }
    | { estado: "omitido"; linea: number; razon: string; identidad?: { nombre: string; grado: string | null; anioLectivo: string | null } }
    | { estado: "error"; linea: number; columna: string; razon: string };

export interface ResultadoValidacion {
    filas: FilaClasificada[];
    resumen: { crear: number; omitidos: number; errores: number };
}

interface OpcionesValidacion {
    /** Set `${nombre}|${grado ?? ""}|${anioLectivo ?? ""}` normalizados (lower + trim). */
    cursosEnBd: ReadonlySet<string>;
    /**
     * Mapa `documento` (uppercase-trim, sin tipo — el rector solo escribe el
     * número) → `profesorId`. Sirve para resolver `profesor_titular_documento`.
     */
    profesoresPorDocumento: ReadonlyMap<string, string>;
}

function claveCurso(nombre: string, grado: string | null, anioLectivo: string | null): string {
    return `${nombre.trim().toLowerCase()}|${(grado ?? "").trim()}|${(anioLectivo ?? "").trim()}`;
}

export function validarFilasCursos(
    filas: FilaCurso[],
    opciones: OpcionesValidacion,
): ResultadoValidacion {
    const resultado: FilaClasificada[] = [];
    const vistosEnLote = new Set<string>();
    const anioActual = new Date().getFullYear();
    const anioMax = anioActual + 2;

    for (const fila of filas) {
        const linea = fila.lineaOriginal;
        const marcarError = (columna: string, razon: string): void => {
            resultado.push({ estado: "error", linea, columna, razon });
        };

        const nombre = fila.nombre.trim();
        if (!nombre) { marcarError("nombre", "Falta el nombre del curso."); continue; }
        if (nombre.length > 80) { marcarError("nombre", "El nombre es muy largo (máximo 80)."); continue; }

        let grado: string | null = null;
        const gradoRaw = fila.grado.trim();
        if (gradoRaw) {
            if (!GRADOS_VALIDOS.includes(gradoRaw)) {
                marcarError("grado", `Grado inválido: "${gradoRaw}". Use un número del 1 al 11.`);
                continue;
            }
            grado = gradoRaw;
        }

        let anioLectivo: string | null = null;
        const anioRaw = fila.anio_lectivo.trim();
        if (anioRaw) {
            const anio = parseInt(anioRaw, 10);
            if (!/^\d{4}$/.test(anioRaw) || !Number.isFinite(anio) || anio < 1900 || anio > anioMax) {
                marcarError("anio_lectivo", `Año lectivo inválido: "${anioRaw}". Use un año entre 1900 y ${anioMax}.`);
                continue;
            }
            anioLectivo = anioRaw;
        }

        let profesorTitularId: string | null = null;
        const docRaw = fila.profesor_titular_documento.trim().toUpperCase();
        if (docRaw) {
            const id = opciones.profesoresPorDocumento.get(docRaw);
            if (!id) {
                marcarError(
                    "profesor_titular_documento",
                    `Profesor con documento "${docRaw}" no está en el colegio (o está inactivo).`,
                );
                continue;
            }
            profesorTitularId = id;
        }

        const clave = claveCurso(nombre, grado, anioLectivo);
        if (opciones.cursosEnBd.has(clave)) {
            resultado.push({
                estado: "omitido",
                linea,
                razon: "Ya existe un curso con ese nombre, grado y año en el colegio.",
                identidad: { nombre, grado, anioLectivo },
            });
            continue;
        }
        if (vistosEnLote.has(clave)) {
            resultado.push({
                estado: "omitido",
                linea,
                razon: "Duplicado en el mismo archivo.",
                identidad: { nombre, grado, anioLectivo },
            });
            continue;
        }
        vistosEnLote.add(clave);

        resultado.push({
            estado: "crear",
            linea,
            curso: { nombre, grado, anioLectivo, profesorTitularId },
        });
    }

    const resumen = {
        crear: resultado.filter((r) => r.estado === "crear").length,
        omitidos: resultado.filter((r) => r.estado === "omitido").length,
        errores: resultado.filter((r) => r.estado === "error").length,
    };

    return { filas: resultado, resumen };
}
