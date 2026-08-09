/**
 * SPEC-148 (US2, FR-003/FR-004): buscador global del colegio (⌘K).
 * Tenant obligatorio por construcción: la firma exige `colegioId` y TODO
 * `where` lo incluye; solo entidades ACTIVAS (un profesor dado de baja sale
 * de la búsqueda pero sigue como titular histórico — COND-2 de SPEC-145).
 * Mínimo 2 caracteres (una query de 1 carácter barre la BD): respuesta vacía
 * inmediata. Relevancia simple: prefijo primero (brief §9), top N por grupo
 * con conteo de restantes ("+12 más").
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export const BUSQUEDA_MIN_CARACTERES = 2;
export const BUSQUEDA_LIMITE_GRUPO = 5;
/** Filas traídas por grupo para rankear "prefijo primero" en memoria. */
const MUESTRA_RANKING = 100;

export interface ResultadoEstudiante {
    id: string;
    nombre: string;
    apellidos: string;
    /** Nombre del curso del estudiante (contexto mínimo del palette). */
    curso: string;
}

export interface ResultadoCurso {
    id: string;
    nombre: string;
    /** Nombre completo del titular, o null si el curso no tiene. */
    titular: string | null;
}

export interface ResultadoProfesor {
    id: string;
    nombre: string;
    apellidos: string;
}

/** DTO del buscador global (spec, Key Entities). */
export interface ResultadoBusquedaColegio {
    estudiantes: ResultadoEstudiante[];
    cursos: ResultadoCurso[];
    profesores: ResultadoProfesor[];
    restantes: { estudiantes: number; cursos: number; profesores: number };
}

export function resultadoVacio(): ResultadoBusquedaColegio {
    return { estudiantes: [], cursos: [], profesores: [], restantes: { estudiantes: 0, cursos: 0, profesores: 0 } };
}

/** Estable: primero quienes EMPIEZAN por la consulta (nombre o apellidos), luego el resto. */
function prefijoPrimero<T extends { nombre: string; apellidos?: string }>(filas: T[], consulta: string): T[] {
    const q = consulta.toLowerCase();
    const empieza = (f: T) =>
        f.nombre.toLowerCase().startsWith(q) || (f.apellidos ?? "").toLowerCase().startsWith(q);
    return [...filas.filter(empieza), ...filas.filter((f) => !empieza(f))];
}

export class BusquedaColegioRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Búsqueda agrupada del colegio. SIEMPRE acotada al tenant y a activos.
     * Menos de 2 caracteres → resultado vacío sin tocar la BD.
     */
    async buscar(colegioId: string, consulta: string, limiteGrupo = BUSQUEDA_LIMITE_GRUPO): Promise<ResultadoBusquedaColegio> {
        const q = consulta.trim();
        if (q.length < BUSQUEDA_MIN_CARACTERES) return resultadoVacio();

        const filtroTextoEstudiante: Prisma.EstudianteWhereInput = {
            OR: [{ nombre: { contains: q, mode: "insensitive" } }, { apellidos: { contains: q, mode: "insensitive" } }],
        };
        const filtroTextoProfesor: Prisma.ProfesorWhereInput = {
            OR: [{ nombre: { contains: q, mode: "insensitive" } }, { apellidos: { contains: q, mode: "insensitive" } }],
        };
        const whereEstudiantes: Prisma.EstudianteWhereInput = { colegioId, estado: "activo", ...filtroTextoEstudiante };
        const whereCursos: Prisma.CursoWhereInput = { colegioId, estado: "activo", nombre: { contains: q, mode: "insensitive" } };
        const whereProfesores: Prisma.ProfesorWhereInput = { colegioId, estado: "activo", ...filtroTextoProfesor };

        const [estudiantes, totalEstudiantes, cursos, totalCursos, profesores, totalProfesores] = await Promise.all([
            this.db.estudiante.findMany({
                where: whereEstudiantes,
                orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
                take: MUESTRA_RANKING,
                include: { curso: { select: { nombre: true } } },
            }),
            this.db.estudiante.count({ where: whereEstudiantes }),
            this.db.curso.findMany({
                where: whereCursos,
                orderBy: { nombre: "asc" },
                take: MUESTRA_RANKING,
                include: { profesorTitular: { select: { nombre: true, apellidos: true } } },
            }),
            this.db.curso.count({ where: whereCursos }),
            this.db.profesor.findMany({
                where: whereProfesores,
                orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
                take: MUESTRA_RANKING,
            }),
            this.db.profesor.count({ where: whereProfesores }),
        ]);

        const itemsEstudiantes = prefijoPrimero(estudiantes, q).slice(0, limiteGrupo);
        const itemsCursos = prefijoPrimero(cursos, q).slice(0, limiteGrupo);
        const itemsProfesores = prefijoPrimero(profesores, q).slice(0, limiteGrupo);

        return {
            estudiantes: itemsEstudiantes.map((e) => ({ id: e.id, nombre: e.nombre, apellidos: e.apellidos, curso: e.curso.nombre })),
            cursos: itemsCursos.map((c) => ({
                id: c.id,
                nombre: c.nombre,
                titular: c.profesorTitular ? `${c.profesorTitular.nombre} ${c.profesorTitular.apellidos}` : null,
            })),
            profesores: itemsProfesores.map((p) => ({ id: p.id, nombre: p.nombre, apellidos: p.apellidos })),
            restantes: {
                estudiantes: Math.max(0, totalEstudiantes - itemsEstudiantes.length),
                cursos: Math.max(0, totalCursos - itemsCursos.length),
                profesores: Math.max(0, totalProfesores - itemsProfesores.length),
            },
        };
    }
}
