/**
 * SPEC-931 · DTO del listado del colegio (Usuarios → Estudiantes).
 *
 * Contrato EXPLÍCITO de lo que sale a la pantalla: id, nombre, curso y dos CONTEOS. Nada más —
 * ni documento, ni contactos de acudientes, ni valores de identificadores—. Se arma campo por
 * campo (nunca `...fila`): si mañana el repo trae otra columna, no se filtra sola a la respuesta.
 */

/** Fila tal como la devuelve `EstudianteRepository.listarDelColegio` (select explícito). */
export interface FilaEstudianteColegio {
    id: string;
    nombre: string;
    apellidos: string;
    curso: { id: string; nombre: string };
    _count: { identificadores: number; acudientes: number };
}

export interface EstudianteListadoDTO {
    id: string;
    /** Nombre para mostrar: nombre + apellidos. */
    nombre: string;
    curso: { id: string; nombre: string };
    /** Identificadores ACTIVOS (los que el motor vigila). */
    identificadoresActivos: number;
    /** Acudientes ACTIVOS. */
    acudientes: number;
}

export function aEstudianteListado(f: FilaEstudianteColegio): EstudianteListadoDTO {
    return {
        id: f.id,
        nombre: `${f.nombre} ${f.apellidos}`.trim(),
        curso: { id: f.curso.id, nombre: f.curso.nombre },
        identificadoresActivos: f._count.identificadores,
        acudientes: f._count.acudientes,
    };
}
