/**
 * SPEC-344 (A-69 · C1 · D-5) — Validador de la carga por Excel de profesores.
 *
 * Fresco contra `main` con suite completa (matiz CEO 03:18). Clasifica cada
 * fila del parser en `crear` | `omitido` | `error` según reglas de negocio
 * (identidad ya existe, sexo/año inválidos, tipo de documento inactivo, etc.).
 */
import type { FilaProfesor } from "./parser";

export const SEXOS_VALIDOS = ["M", "F", "OTRO"] as const;
export type SexoValido = (typeof SEXOS_VALIDOS)[number];

export interface ProfesorNormalizado {
    nombre: string;
    apellidos: string;
    tipoDocumento: string;
    numeroDocumento: string;
    anioNacimiento: number;
    sexo: SexoValido;
    email: string;
    telefono: string;
}

export type FilaClasificada =
    | { estado: "crear"; linea: number; profesor: ProfesorNormalizado }
    | { estado: "omitido"; linea: number; razon: string; identidad?: { nombre: string; documento: string } }
    | { estado: "error"; linea: number; columna: string; razon: string };

export interface ResultadoValidacion {
    filas: FilaClasificada[];
    resumen: { crear: number; omitidos: number; errores: number };
}

interface OpcionesValidacion {
    tiposDocumentoActivos: ReadonlySet<string>;
    /** Documentos ya registrados en el colegio (por `${tipo}|${numero}` normalizados). */
    documentosEnBd: ReadonlySet<string>;
}

function esEmailValido(v: string): boolean {
    // Simple pero suficiente; el schema Zod ya valida en el alta individual.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizarDoc(tipo: string, numero: string): string {
    return `${tipo.trim().toUpperCase()}|${numero.trim().toUpperCase()}`;
}

export function validarFilasProfesores(
    filas: FilaProfesor[],
    opciones: OpcionesValidacion,
): ResultadoValidacion {
    const resultado: FilaClasificada[] = [];
    const vistosEnLote = new Set<string>();
    const anioActual = new Date().getFullYear();

    for (const fila of filas) {
        const linea = fila.lineaOriginal;

        const marcarError = (columna: string, razon: string): void => {
            resultado.push({ estado: "error", linea, columna, razon });
        };

        if (!fila.nombre) { marcarError("nombre", "Falta el nombre."); continue; }
        if (!fila.apellidos) { marcarError("apellidos", "Faltan los apellidos."); continue; }
        if (!fila.tipo_documento) { marcarError("tipo_documento", "Falta el tipo de documento."); continue; }
        if (!fila.numero_documento) { marcarError("numero_documento", "Falta el número de documento."); continue; }
        if (!fila.anio_nacimiento) { marcarError("anio_nacimiento", "Falta el año de nacimiento."); continue; }
        if (!fila.sexo) { marcarError("sexo", "Falta el sexo."); continue; }
        if (!fila.email) { marcarError("email", "Falta el correo."); continue; }
        if (!fila.telefono) { marcarError("telefono", "Falta el teléfono."); continue; }

        const tipoNormalizado = fila.tipo_documento.trim().toUpperCase();
        if (!opciones.tiposDocumentoActivos.has(tipoNormalizado)) {
            marcarError("tipo_documento", `Tipo de documento no reconocido: "${fila.tipo_documento}".`);
            continue;
        }

        const sexoNormalizado = fila.sexo.trim().toUpperCase();
        if (!(SEXOS_VALIDOS as readonly string[]).includes(sexoNormalizado)) {
            marcarError("sexo", `Sexo inválido: "${fila.sexo}". Use M, F u OTRO.`);
            continue;
        }

        const anio = parseInt(fila.anio_nacimiento, 10);
        if (!Number.isFinite(anio) || anio < 1900 || anio > anioActual) {
            marcarError("anio_nacimiento", `Año inválido: "${fila.anio_nacimiento}".`);
            continue;
        }

        if (!esEmailValido(fila.email)) {
            marcarError("email", `Correo inválido: "${fila.email}".`);
            continue;
        }

        const clave = normalizarDoc(tipoNormalizado, fila.numero_documento);
        if (opciones.documentosEnBd.has(clave)) {
            resultado.push({
                estado: "omitido",
                linea,
                razon: "Documento ya registrado en el colegio.",
                identidad: { nombre: `${fila.nombre} ${fila.apellidos}`, documento: `${tipoNormalizado} ${fila.numero_documento}` },
            });
            continue;
        }
        if (vistosEnLote.has(clave)) {
            resultado.push({
                estado: "omitido",
                linea,
                razon: "Duplicado en el mismo archivo.",
                identidad: { nombre: `${fila.nombre} ${fila.apellidos}`, documento: `${tipoNormalizado} ${fila.numero_documento}` },
            });
            continue;
        }
        vistosEnLote.add(clave);

        resultado.push({
            estado: "crear",
            linea,
            profesor: {
                nombre: fila.nombre.trim(),
                apellidos: fila.apellidos.trim(),
                tipoDocumento: tipoNormalizado,
                numeroDocumento: fila.numero_documento.trim(),
                anioNacimiento: anio,
                sexo: sexoNormalizado as SexoValido,
                email: fila.email.trim().toLowerCase(),
                telefono: fila.telefono.trim(),
            },
        });
    }

    const resumen = {
        crear: resultado.filter((r) => r.estado === "crear").length,
        omitidos: resultado.filter((r) => r.estado === "omitido").length,
        errores: resultado.filter((r) => r.estado === "error").length,
    };

    return { filas: resultado, resumen };
}
