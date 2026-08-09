/**
 * SPEC-146 (T005) — Tipos y helpers puros del wizard unificado (estado del
 * formulario, validación cliente y construcción del payload para
 * POST /api/colegio/cursos/unificado). Sin React: se testean directo y los
 * comparten los 5 componentes del wizard.
 */
import type { FilaListaValidada } from "@/lib/colegio/unificado/validar-lista";

export interface AcudienteForm {
    nombre: string;
    relacion: string;
    telefono: string;
    email: string;
}

export interface IdentificadorForm {
    /** Vacío = se infiere del valor en el servidor. */
    tipo: string;
    valor: string;
    plataformaId: string;
    etiquetaRelacion: string;
}

export interface EstudianteForm {
    /** Clave estable para React (contador del wizard — nunca Math.random en render). */
    key: string;
    nombre: string;
    apellidos: string;
    documentoTipo: string;
    documentoNumero: string;
    acudientes: AcudienteForm[];
    identificadores: IdentificadorForm[];
}

export interface CursoForm {
    nombre: string;
    grado: string;
    anioLectivo: string;
    profesorTitularId: string;
}

export interface ProfesorNuevoForm {
    nombre: string;
    apellidos: string;
}

export type ModoProfesor = "existente" | "nuevo";
export type ModoEstudiantes = "manual" | "excel";

export const ETIQUETAS_RELACION = ["ESTUDIANTE", "MADRE", "PADRE", "PRIMO", "TUTOR", "OTRO"] as const;

export const DOCUMENTO_TIPO_OPCIONES = [
    { value: "", label: "Sin documento" },
    { value: "RC", label: "Registro civil" },
    { value: "TI", label: "Tarjeta de identidad" },
    { value: "CC", label: "Cédula" },
    { value: "CE", label: "Cédula de extranjería" },
    { value: "PASAPORTE", label: "Pasaporte" },
    { value: "OTRO", label: "Otro" },
];

export function estudianteVacio(key: string): EstudianteForm {
    return { key, nombre: "", apellidos: "", documentoTipo: "", documentoNumero: "", acudientes: [], identificadores: [] };
}

export function identificadorVacio(): IdentificadorForm {
    return { tipo: "", valor: "", plataformaId: "", etiquetaRelacion: "ESTUDIANTE" };
}

export interface ErroresWizard {
    curso?: string;
    /** Mensaje por clave de estudiante (fila marcada, no se guarda — §7.1). */
    estudiantes: Record<string, string>;
}

/**
 * Validación cliente (espejo amable del Zod del servidor): solo nombre y
 * apellidos bloquean; el resto NUNCA (§7.1 del brief).
 */
export function validarWizard(curso: CursoForm, estudiantes: EstudianteForm[]): ErroresWizard | null {
    const errores: ErroresWizard = { estudiantes: {} };
    if (curso.nombre.trim().length < 2) {
        errores.curso = "Escribe el nombre del curso";
    }
    for (const e of estudiantes) {
        if (!e.nombre.trim()) {
            errores.estudiantes[e.key] = "Falta el nombre";
        } else if (!e.apellidos.trim()) {
            errores.estudiantes[e.key] = "Falta el apellido";
        }
    }
    if (errores.curso || Object.keys(errores.estudiantes).length > 0) return errores;
    return null;
}

/** Payload del POST unificado (la forma la fija payloadUnificadoSchema). */
export function construirPayload(
    curso: CursoForm,
    modoProfesor: ModoProfesor,
    profesorNuevo: ProfesorNuevoForm,
    estudiantes: EstudianteForm[]
) {
    return {
        curso: {
            nombre: curso.nombre.trim(),
            ...(curso.grado.trim() ? { grado: curso.grado.trim() } : {}),
            ...(curso.anioLectivo.trim() ? { anioLectivo: curso.anioLectivo.trim() } : {}),
            ...(modoProfesor === "existente" && curso.profesorTitularId ? { profesorTitularId: curso.profesorTitularId } : {}),
        },
        ...(modoProfesor === "nuevo" && profesorNuevo.nombre.trim() && profesorNuevo.apellidos.trim()
            ? { profesorNuevo: { nombre: profesorNuevo.nombre.trim(), apellidos: profesorNuevo.apellidos.trim() } }
            : {}),
        estudiantes: estudiantes.map((e) => ({
            nombre: e.nombre.trim(),
            apellidos: e.apellidos.trim(),
            ...(e.documentoTipo ? { documentoTipo: e.documentoTipo } : {}),
            ...(e.documentoNumero.trim() ? { documentoNumero: e.documentoNumero.trim() } : {}),
            ...(e.acudientes.length > 0
                ? {
                    acudientes: e.acudientes
                        .filter((a) => a.nombre.trim() && a.relacion.trim())
                        .map((a, i) => ({
                            orden: (i + 1) as 1 | 2,
                            nombre: a.nombre.trim(),
                            relacion: a.relacion.trim(),
                            ...(a.telefono.trim() ? { telefono: a.telefono.trim() } : {}),
                            ...(a.email.trim() ? { email: a.email.trim() } : {}),
                        })),
                }
                : {}),
        })),
        identificadores: estudiantes.flatMap((e, estudianteIndex) =>
            e.identificadores
                .filter((id) => id.valor.trim())
                .map((id) => ({
                    estudianteIndex,
                    ...(id.tipo ? { tipo: id.tipo } : {}),
                    valor: id.valor.trim(),
                    ...(id.plataformaId ? { plataformaId: id.plataformaId } : {}),
                    ...(id.etiquetaRelacion ? { etiquetaRelacion: id.etiquetaRelacion } : {}),
                }))
        ),
    };
}

/**
 * Convierte las filas válidas de la dry-run en filas de la tabla editable
 * ("guardar solo los correctos" — §5.4). Agrupa por estudiante (una fila del
 * archivo por identificador) y toma el primer acudiente disponible.
 */
export function filasAEstudiantes(filas: FilaListaValidada[], siguienteClave: () => string): EstudianteForm[] {
    const porClave = new Map<string, EstudianteForm>();
    for (const fila of filas) {
        const clave = `${fila.estudiante.nombre.trim().toLowerCase()}|${fila.estudiante.apellidos.trim().toLowerCase()}`;
        let estudiante = porClave.get(clave);
        if (!estudiante) {
            estudiante = estudianteVacio(siguienteClave());
            estudiante.nombre = fila.estudiante.nombre;
            estudiante.apellidos = fila.estudiante.apellidos;
            porClave.set(clave, estudiante);
        }
        if (fila.acudiente && estudiante.acudientes.length < 2) {
            estudiante.acudientes.push({
                nombre: fila.acudiente.nombre,
                relacion: fila.acudiente.relacion,
                telefono: fila.acudiente.telefono ?? "",
                email: fila.acudiente.email ?? "",
            });
        }
        if (fila.identificador) {
            estudiante.identificadores.push({
                tipo: fila.identificador.tipo,
                valor: fila.identificador.valor,
                plataformaId: fila.identificador.plataformaId ?? "",
                etiquetaRelacion: fila.identificador.etiquetaRelacion,
            });
        }
    }
    return [...porClave.values()];
}
