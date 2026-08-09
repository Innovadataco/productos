/**
 * SPEC-146 (FR-003) — Dry-run de la lista del wizard unificado.
 *
 * Reusa el pipeline de carga existente (`validarFilasCarga`) para las filas CON
 * identificador y aplica las MISMAS reglas Zod (curso/estudiante) a las filas
 * SIN identificador — en el wizard el identificador es opcional (sección 3),
 * a diferencia del pipeline viejo donde toda fila lo exige (su validator.test
 * lo fija: no se toca). Las columnas de acudiente (opcionales) se validan con
 * mensajes humanos (§4.6): nombre y relación son obligatorios si se diligencia
 * el acudiente; el email, si viene, debe parecer email.
 *
 * Stateless: nada se persiste ni se crea sesión roster — las filas válidas
 * vuelven al cliente y se re-validan con Zod en el guardado final (FR-002).
 */
import { cursoBodySchema, estudianteBodySchema, emailSchema } from "@/lib/schemas";
import { validarFilasCarga } from "../carga/validator";
import type { FilaCargaEstudiante, ErrorFila } from "../carga/parser";
import type { EtiquetaRelacionEstudiante } from "@prisma/client";

export type AcudienteLista = {
    nombre: string;
    relacion: string;
    telefono?: string;
    email?: string;
};

export type IdentificadorLista = {
    tipo: string;
    valor: string;
    etiquetaRelacion: EtiquetaRelacionEstudiante;
    plataformaId: string | null;
};

export type FilaListaValidada = {
    fila: number;
    estudiante: { nombre: string; apellidos: string };
    acudiente: AcudienteLista | null;
    identificador: IdentificadorLista | null;
};

export type ResultadoValidacionLista = {
    filasValidas: FilaListaValidada[];
    problemas: ErrorFila[];
    resumen: {
        estudiantes: number;
        identificadores: number;
        conProblemas: number;
        total: number;
    };
};

function claveEstudiante(nombre: string, apellidos: string): string {
    return `${nombre.trim().toLowerCase()}|${apellidos.trim().toLowerCase()}`;
}

/**
 * Valida el acudiente opcional de una fila. Devuelve el acudiente normalizado
 * (null si la fila no trae ninguno) o el problema a reportar.
 */
function validarAcudiente(
    fila: FilaCargaEstudiante
): { acudiente: AcudienteLista | null; problema: ErrorFila | null } {
    const crudo = fila.acudiente;
    if (!crudo) return { acudiente: null, problema: null };

    const vacio = !crudo.nombre && !crudo.relacion && !crudo.telefono && !crudo.email;
    if (vacio) return { acudiente: null, problema: null };

    if (crudo.nombre.trim().length < 2) {
        return {
            acudiente: null,
            problema: { fila: fila.fila, campos: ["acudiente_nombre"], mensaje: "Falta el nombre del acudiente" },
        };
    }
    if (!crudo.relacion.trim()) {
        return {
            acudiente: null,
            problema: {
                fila: fila.fila,
                campos: ["acudiente_relacion"],
                mensaje: "Falta la relación del acudiente (madre, padre, tutor…)",
            },
        };
    }
    if (crudo.email && !emailSchema.safeParse(crudo.email.trim()).success) {
        return {
            acudiente: null,
            problema: {
                fila: fila.fila,
                campos: ["acudiente_email"],
                mensaje: `"${crudo.email.trim()}" no parece ser un email`,
            },
        };
    }

    return {
        acudiente: {
            nombre: crudo.nombre.trim(),
            relacion: crudo.relacion.trim(),
            ...(crudo.telefono.trim() ? { telefono: crudo.telefono.trim() } : {}),
            ...(crudo.email.trim() ? { email: crudo.email.trim() } : {}),
        },
        problema: null,
    };
}

export function validarFilasUnificado(
    filas: FilaCargaEstudiante[],
    plataformas: Map<string, string>
): ResultadoValidacionLista {
    const problemas: ErrorFila[] = [];
    const filasValidas: FilaListaValidada[] = [];
    const estudiantesVistos = new Set<string>();

    // 1. Filas CON identificador: delega en el pipeline existente (dedup,
    // normalización del valor, resolución de plataforma, etiqueta válida).
    const conIdentificador = filas.filter((f) => f.identificador.tipo.trim() !== "" || f.identificador.valor.trim() !== "");
    const sinIdentificador = filas.filter((f) => f.identificador.tipo.trim() === "" && f.identificador.valor.trim() === "");

    const validacionConId = validarFilasCarga(conIdentificador, plataformas);
    problemas.push(...validacionConId.errores);

    for (const fila of validacionConId.filasValidas) {
        const { acudiente, problema } = validarAcudiente(fila);
        if (problema) {
            problemas.push(problema);
            continue;
        }
        filasValidas.push({
            fila: fila.fila,
            estudiante: { nombre: fila.alumno.nombre, apellidos: fila.alumno.apellidos },
            acudiente,
            identificador: {
                tipo: fila.identificador.tipo,
                valor: fila.identificador.valor,
                etiquetaRelacion: fila.identificador.etiquetaRelacion,
                plataformaId: fila.identificador.plataformaId,
            },
        });
        estudiantesVistos.add(claveEstudiante(fila.alumno.nombre, fila.alumno.apellidos));
    }

    // 2. Filas SIN identificador (válidas en el wizard: la sección 3 es
    // opcional). Mismas reglas Zod de curso + estudiante que el pipeline.
    const vistosSinId = new Set<string>();
    for (const fila of sinIdentificador) {
        const campos: string[] = [];
        const mensajes: string[] = [];

        const cursoParsed = cursoBodySchema.safeParse(fila.curso);
        if (!cursoParsed.success) {
            campos.push("nombre_curso", "grado", "anio_lectivo");
            mensajes.push(cursoParsed.error.issues.map((i) => i.message).join("; "));
        }

        const estudianteParsed = estudianteBodySchema.safeParse(fila.alumno);
        if (!estudianteParsed.success) {
            for (const issue of estudianteParsed.error.issues) {
                campos.push(issue.path[0] === "apellidos" ? "apellidos_alumno" : "nombre_alumno");
                mensajes.push(issue.message);
            }
        }

        if (campos.length > 0) {
            problemas.push({ fila: fila.fila, campos: [...new Set(campos)], mensaje: mensajes.join("; ") });
            continue;
        }

        // Una segunda fila sin identificador para el mismo estudiante no aporta
        // nada (la primera ya lo cubre) — se marca como repetida.
        const clave = claveEstudiante(fila.alumno.nombre, fila.alumno.apellidos);
        if (vistosSinId.has(clave)) {
            problemas.push({
                fila: fila.fila,
                campos: ["nombre_alumno", "apellidos_alumno"],
                mensaje: "Este estudiante viene repetido en el archivo",
            });
            continue;
        }
        vistosSinId.add(clave);

        const { acudiente, problema } = validarAcudiente(fila);
        if (problema) {
            problemas.push(problema);
            continue;
        }

        filasValidas.push({
            fila: fila.fila,
            estudiante: { nombre: fila.alumno.nombre, apellidos: fila.alumno.apellidos },
            acudiente,
            identificador: null,
        });
        estudiantesVistos.add(clave);
    }

    // Orden de vuelta al archivo (las filas válidas llegan mezcladas de ambos grupos).
    filasValidas.sort((a, b) => a.fila - b.fila);
    problemas.sort((a, b) => a.fila - b.fila);

    return {
        filasValidas,
        problemas,
        resumen: {
            estudiantes: estudiantesVistos.size,
            identificadores: filasValidas.filter((f) => f.identificador !== null).length,
            conProblemas: problemas.length,
            total: filas.length,
        },
    };
}
