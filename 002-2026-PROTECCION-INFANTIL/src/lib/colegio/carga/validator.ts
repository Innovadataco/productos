import { cursoBodySchema, alumnoBodySchema, etiquetaRelacionAlumnoSchema } from "@/lib/schemas";
import { normalizarIdentificador } from "@/lib/colegio/normalizacion";
import type { FilaCargaAlumno, ErrorFila } from "./parser";
import type { EtiquetaRelacionAlumno } from "@prisma/client";

export type ResultadoValidacion = {
    filasValidas: FilaCargaAlumno[];
    errores: ErrorFila[];
    resumen: {
        cursos: number;
        alumnos: number;
        identificadores: number;
    };
};

function validarEtiquetaRelacion(valor: string): { valido: boolean; normalizado?: EtiquetaRelacionAlumno; mensaje?: string } {
    const parsed = etiquetaRelacionAlumnoSchema.safeParse(valor.toUpperCase());
    if (!parsed.success) {
        return {
            valido: false,
            mensaje: `Etiqueta de relación inválida. Valores permitidos: ${etiquetaRelacionAlumnoSchema.options.join(", ")}`,
        };
    }
    return { valido: true, normalizado: parsed.data };
}

function claveAlumno(fila: FilaCargaAlumno): string {
    return [
        fila.curso.nombre.toLowerCase(),
        fila.curso.grado?.toLowerCase() ?? "",
        fila.curso.anioLectivo?.toLowerCase() ?? "",
        fila.alumno.nombre.toLowerCase(),
    ].join("|");
}

function claveIdentificador(fila: FilaCargaAlumno, plataformaId: string | null): string {
    const valorNormalizado = normalizarIdentificador(fila.identificador.valor, fila.identificador.tipo);
    return [
        claveAlumno(fila),
        fila.identificador.tipo.toLowerCase(),
        valorNormalizado,
        plataformaId ?? "",
    ].join("|");
}

function claveCurso(fila: FilaCargaAlumno): string {
    return [
        fila.curso.nombre.toLowerCase(),
        fila.curso.grado?.toLowerCase() ?? "",
        fila.curso.anioLectivo?.toLowerCase() ?? "",
    ].join("|");
}

/**
 * Valida un listado de filas parseadas contra las reglas de Fase 2.
 *
 * @param filas - Filas provenientes del parser.
 * @param plataformas - Mapa de nombre de plataforma (minúsculas) a su id.
 */
export function validarFilasCarga(
    filas: FilaCargaAlumno[],
    plataformas: Map<string, string>
): ResultadoValidacion {
    const errores: ErrorFila[] = [];
    const filasValidas: FilaCargaAlumno[] = [];
    const vistosAlumno = new Set<string>();
    const vistosIdentificador = new Set<string>();
    const cursosVistos = new Set<string>();
    const alumnosVistos = new Set<string>();

    for (const fila of filas) {
        const campos: string[] = [];
        const mensajes: string[] = [];

        const cursoParsed = cursoBodySchema.safeParse(fila.curso);
        if (!cursoParsed.success) {
            campos.push("nombre_curso", "grado", "anio_lectivo");
            mensajes.push(cursoParsed.error.issues.map((i) => i.message).join("; "));
        }

        const alumnoParsed = alumnoBodySchema.safeParse(fila.alumno);
        if (!alumnoParsed.success) {
            campos.push("nombre_alumno");
            mensajes.push(alumnoParsed.error.issues.map((i) => i.message).join("; "));
        }

        if (!fila.identificador.tipo) {
            campos.push("tipo_identificador");
            mensajes.push("El tipo de identificador es requerido");
        } else if (fila.identificador.tipo.length > 50) {
            campos.push("tipo_identificador");
            mensajes.push("El tipo de identificador no puede exceder 50 caracteres");
        }

        if (!fila.identificador.valor) {
            campos.push("valor_identificador");
            mensajes.push("El valor del identificador es requerido");
        } else if (fila.identificador.valor.length > 255) {
            campos.push("valor_identificador");
            mensajes.push("El valor del identificador no puede exceder 255 caracteres");
        }

        const etiqueta = validarEtiquetaRelacion(fila.identificador.etiquetaRelacion);
        if (!etiqueta.valido) {
            campos.push("etiqueta_relacion");
            mensajes.push(etiqueta.mensaje!);
        }

        let plataformaId: string | null = null;
        if (fila.identificador.plataformaId) {
            const buscado = fila.identificador.plataformaId.toLowerCase().trim();
            const encontrado = plataformas.get(buscado);
            if (!encontrado) {
                campos.push("plataforma");
                mensajes.push(`Plataforma no encontrada: ${fila.identificador.plataformaId}`);
            } else {
                plataformaId = encontrado;
            }
        }

        if (campos.length > 0) {
            errores.push({
                fila: fila.fila,
                campos: [...new Set(campos)],
                mensaje: mensajes.join("; "),
            });
            continue;
        }

        // Detectar duplicados internos de identificador (mismo alumno + mismo identificador).
        const keyAlumno = claveAlumno(fila);
        const keyIdentificador = claveIdentificador(fila, plataformaId);
        if (vistosIdentificador.has(keyIdentificador)) {
            errores.push({
                fila: fila.fila,
                campos: ["tipo_identificador", "valor_identificador", "plataforma"],
                mensaje: "Identificador duplicado dentro del archivo para el mismo alumno",
            });
            continue;
        }

        // Detectar alumno con distintos datos? No aplica: el parser permite un alumno repetido
        // con varios identificadores, eso es válido.

        vistosAlumno.add(keyAlumno);
        vistosIdentificador.add(keyIdentificador);

        // Normalizar fila validada con plataforma resuelta y valor normalizado.
        const filaValidada: FilaCargaAlumno = {
            ...fila,
            identificador: {
                ...fila.identificador,
                valor: normalizarIdentificador(fila.identificador.valor, fila.identificador.tipo),
                etiquetaRelacion: etiqueta.normalizado!,
                plataformaId,
            },
        };

        filasValidas.push(filaValidada);

        cursosVistos.add(claveCurso(filaValidada));
        alumnosVistos.add(claveAlumno(filaValidada));
    }

    return {
        filasValidas,
        errores,
        resumen: {
            cursos: cursosVistos.size,
            alumnos: alumnosVistos.size,
            identificadores: filasValidas.length,
        },
    };
}
