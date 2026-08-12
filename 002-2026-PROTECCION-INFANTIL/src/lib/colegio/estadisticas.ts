import type { EstadoReporte } from "@prisma/client";
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { IdentificadorEstudianteRepository } from "@/lib/dal/repositories/identificador-estudiante";
import { ProfesorRepository } from "@/lib/dal/repositories/profesor";

const ESTADOS_VISIBLES: EstadoReporte[] = [
    "CLASIFICADO",
    "CORREGIDO",
    "REVISION_MANUAL",
    "POSIBLE_SPAM",
    "REQUIERE_ANONIMIZACION",
];

export interface EstadisticasCurso {
    cursoId: string;
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
    alumnos: number;
    identificadores: number;
    alertas: number;
}

export interface EstadisticasColegio {
    colegioId: string;
    colegioNombre: string;
    totales: {
        cursos: number;
        profesores: number;
        alumnos: number;
        identificadores: number;
        alertas: number;
    };
    porCurso: EstadisticasCurso[];
}

/**
 * Calcula estadísticas agregadas de un colegio.
 * No expone PII: solo conteos por curso y totales.
 * Las alertas se cuentan solo si el reporte asociado no está eliminado y está en un estado visible.
 *
 * SPEC-134 (E-1): el acceso a datos vive en los repos del DAL (tenant obligatorio);
 * aquí queda solo el armado del resultado.
 */
export async function calcularEstadisticasColegio(colegioId: string): Promise<EstadisticasColegio> {
    const colegio = await new ColegioRepository().obtenerResumen(colegioId);
    if (!colegio) {
        throw new Error("Colegio no encontrado");
    }

    const [totalesGenerales, cursos] = await Promise.all([
        calcularTotalesGenerales(colegioId),
        new CursoRepository().listarParaEstadisticas(colegioId),
    ]);

    const cursoIds = cursos.map((c) => c.id);

    const [alumnosPorCurso, identificadoresPorCurso, alertasPorCurso] = await Promise.all([
        new EstudianteRepository().contarPorCursoIds(colegioId, cursoIds),
        new IdentificadorEstudianteRepository().contarPorCursoIds(colegioId, cursoIds),
        new AlertaColegioRepository().contarVisiblesPorCursoIds(colegioId, cursoIds, ESTADOS_VISIBLES),
    ]);

    const porCurso: EstadisticasCurso[] = cursos.map((curso) => ({
        cursoId: curso.id,
        nombre: curso.nombre,
        grado: curso.grado,
        anioLectivo: curso.anioLectivo,
        alumnos: alumnosPorCurso.get(curso.id) ?? 0,
        identificadores: identificadoresPorCurso.get(curso.id) ?? 0,
        alertas: alertasPorCurso.get(curso.id) ?? 0,
    }));

    return {
        colegioId: colegio.id,
        colegioNombre: colegio.nombre,
        totales: totalesGenerales,
        porCurso,
    };
}

async function calcularTotalesGenerales(colegioId: string) {
    const [cursos, profesores, alumnos, identificadores, alertas] = await Promise.all([
        new CursoRepository().contarPorColegio(colegioId),
        new ProfesorRepository().contar(colegioId, "activo"),
        new EstudianteRepository().contarPorColegio(colegioId),
        new IdentificadorEstudianteRepository().contarPorColegio(colegioId),
        new AlertaColegioRepository().contarVisiblesPorColegio(colegioId, ESTADOS_VISIBLES),
    ]);

    return { cursos, profesores, alumnos, identificadores, alertas };
}
