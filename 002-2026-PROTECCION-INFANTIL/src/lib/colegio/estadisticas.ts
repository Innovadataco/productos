import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EstadoReporte } from "@prisma/client";

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
 */
export async function calcularEstadisticasColegio(colegioId: string): Promise<EstadisticasColegio> {
    const colegio = await prisma.colegio.findUnique({
        where: { id: colegioId },
        select: { id: true, nombre: true },
    });
    if (!colegio) {
        throw new Error("Colegio no encontrado");
    }

    const [totalesGenerales, cursos] = await Promise.all([
        calcularTotalesGenerales(colegioId),
        prisma.curso.findMany({
            where: { colegioId },
            select: {
                id: true,
                nombre: true,
                grado: true,
                anioLectivo: true,
            },
            orderBy: [{ nombre: "asc" }, { grado: "asc" }],
        }),
    ]);

    const cursoIds = cursos.map((c) => c.id);

    const [alumnosPorCurso, identificadoresPorCurso, alertasPorCurso] = await Promise.all([
        contarAlumnosPorCurso(cursoIds),
        contarIdentificadoresPorCurso(cursoIds),
        contarAlertasPorCurso(cursoIds),
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
    const [cursos, alumnos, identificadores, alertas] = await Promise.all([
        prisma.curso.count({ where: { colegioId } }),
        prisma.alumno.count({ where: { colegioId } }),
        prisma.identificadorAlumno.count({
            where: {
                alumno: { colegioId },
            },
        }),
        prisma.alertaColegio.count({
            where: {
                colegioId,
                reporte: {
                    eliminado: false,
                    estado: { in: ESTADOS_VISIBLES },
                },
            },
        }),
    ]);

    return { cursos, alumnos, identificadores, alertas };
}

async function contarAlumnosPorCurso(cursoIds: string[]): Promise<Map<string, number>> {
    if (cursoIds.length === 0) return new Map();

    const rows = await prisma.alumno.groupBy({
        by: ["cursoId"],
        where: { cursoId: { in: cursoIds } },
        _count: { cursoId: true },
    });

    return new Map(rows.map((r) => [r.cursoId, r._count.cursoId]));
}

async function contarIdentificadoresPorCurso(cursoIds: string[]): Promise<Map<string, number>> {
    if (cursoIds.length === 0) return new Map();

    const resultados: { cursoId: string; total: bigint }[] = await prisma.$queryRaw`
        SELECT a."cursoId" as "cursoId", COUNT(*) as total
        FROM "IdentificadorAlumno" i
        JOIN "Alumno" a ON a.id = i."alumnoId"
        WHERE a."cursoId" IN (${Prisma.join(cursoIds)})
        GROUP BY a."cursoId"
    `;

    return new Map(resultados.map((r) => [r.cursoId, Number(r.total)]));
}

async function contarAlertasPorCurso(cursoIds: string[]): Promise<Map<string, number>> {
    if (cursoIds.length === 0) return new Map();

    const resultados: { cursoId: string; total: bigint }[] = await prisma.$queryRaw`
        SELECT a."cursoId" as "cursoId", COUNT(*) as total
        FROM "AlertaColegio" ac
        JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
        JOIN "Alumno" a ON a.id = i."alumnoId"
        JOIN "Reporte" r ON r.id = ac."reporteId"
        WHERE a."cursoId" IN (${Prisma.join(cursoIds)})
          AND ac."colegioId" = a."colegioId"
          AND r.eliminado = false
          AND r.estado::text IN (${Prisma.join(ESTADOS_VISIBLES)})
        GROUP BY a."cursoId"
    `;

    return new Map(resultados.map((r) => [r.cursoId, Number(r.total)]));
}
