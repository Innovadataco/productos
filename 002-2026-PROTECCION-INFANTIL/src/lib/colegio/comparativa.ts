import { calcularEstadisticasColegio } from "./estadisticas";

export type CriterioAgrupacion = "grado" | "anioLectivo";

export interface ComparativaGrupo {
    grupo: string;
    cursos: number;
    estudiantes: number;
    identificadores: number;
    alertas: number;
    promedioEstudiantes: number;
}

export interface ComparativaCursos {
    colegioId: string;
    colegioNombre: string;
    agruparPor: CriterioAgrupacion;
    grupos: ComparativaGrupo[];
    totales: {
        cursos: number;
        estudiantes: number;
        identificadores: number;
        alertas: number;
    };
}

/**
 * Calcula una comparativa agregada de cursos por grado o año lectivo.
 * Reutiliza `calcularEstadisticasColegio` para mantener consistencia y tenant-first.
 * No expone PII: solo conteos agregados.
 */
export async function calcularComparativaCursos(
    colegioId: string,
    agruparPor: CriterioAgrupacion
): Promise<ComparativaCursos> {
    const estadisticas = await calcularEstadisticasColegio(colegioId);
    const mapa = new Map<string, ComparativaGrupo>();

    for (const curso of estadisticas.porCurso) {
        const clave = agruparPor === "grado" ? (curso.grado ?? "Sin grado") : (curso.anioLectivo ?? "Sin año");
        const existente = mapa.get(clave);
        if (existente) {
            existente.cursos += 1;
            existente.estudiantes += curso.alumnos;
            existente.identificadores += curso.identificadores;
            existente.alertas += curso.alertas;
        } else {
            mapa.set(clave, {
                grupo: clave,
                cursos: 1,
                estudiantes: curso.alumnos,
                identificadores: curso.identificadores,
                alertas: curso.alertas,
                promedioEstudiantes: 0,
            });
        }
    }

    const grupos = Array.from(mapa.values())
        .map((grupo) => ({
            ...grupo,
            promedioEstudiantes: grupo.cursos > 0 ? Math.round((grupo.estudiantes / grupo.cursos) * 10) / 10 : 0,
        }))
        .sort((a, b) => a.grupo.localeCompare(b.grupo, "es-CO"));

    return {
        colegioId: estadisticas.colegioId,
        colegioNombre: estadisticas.colegioNombre,
        agruparPor,
        grupos,
        totales: estadisticas.totales,
    };
}
