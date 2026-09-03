/**
 * SPEC-134 (E-1): repositorio de CargaRosterSesion — tenant obligatorio por
 * construcción. Absorbe el acceso a datos de `src/lib/colegio/carga/sesion-roster.ts`
 * (SPEC-132, S-4/O-2): el roster vive server-side con TTL, la lectura aplica las
 * guardas (existe, MISMO colegio, no vencida) y el consumo es single-use dentro de
 * la tx del import. Acepta un cliente transaccional opcional (D2) — `consumir` DEBE
 * correr con la tx del import (misma semántica actual).
 *
 * EXCEPCIÓN DOCUMENTADA (sin tenant): `purgarExpiradas` es el job backstop global
 * del worker — borra sesiones vencidas de TODOS los colegios (igual que hoy).
 */
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { aJson } from "../json";
import { etiquetaRelacionEstudianteSchema } from "@/lib/schemas";
import type { DbClient } from "../unit-of-work";
import type { FilaCargaEstudiante } from "@/lib/colegio/carga/parser";

const TTL_MINUTOS = 15;

// SPEC-136 (E-3): el roster se lee de vuelta validándolo con Zod (la forma que
// escribe `crear`), no con un cast que afirma el contenido sin mirarlo.
const filaCargaAlumnoJsonSchema = z.object({
    fila: z.number(),
    curso: z.object({
        nombre: z.string(),
        grado: z.string().nullable(),
        anioLectivo: z.string().nullable(),
    }),
    // SPEC-320 (§2.2-bis): documento del alumno (default "" para sesiones roster viejas
    // sin la columna; validar-lista las marca como fila con problema al reprocesar).
    alumno: z.object({
        nombre: z.string(),
        apellidos: z.string(),
        documentoTipo: z.string().default(""),
        documentoNumero: z.string().default(""),
    }),
    identificador: z.object({
        tipo: z.string(),
        valor: z.string(),
        etiquetaRelacion: etiquetaRelacionEstudianteSchema,
        plataformaId: z.string().nullable(),
    }),
});
const filasRosterSchema = z.array(filaCargaAlumnoJsonSchema);

// SPEC-344 (A-69 · C1 · D-5): la carga de PROFESORES reusa el mismo modelo de
// sesión server-side (PII fuera del JWT, single-use, TTL 15 min) pero su
// roster tiene OTRA forma — el ProfesorNormalizado del validador fresco. Se
// lee de vuelta validando con Zod, igual que el de alumnos (SPEC-136 E-3).
const filaProfesorJsonSchema = z.object({
    nombre: z.string(),
    apellidos: z.string(),
    tipoDocumento: z.string(),
    numeroDocumento: z.string(),
    anioNacimiento: z.number(),
    sexo: z.enum(["M", "F", "OTRO"]),
    email: z.string(),
    telefono: z.string(),
});
const filasRosterProfesoresSchema = z.array(filaProfesorJsonSchema);

export type FilaRosterProfesor = z.infer<typeof filaProfesorJsonSchema>;

export type SesionRosterProfesores = {
    id: string;
    colegioId: string;
    filas: FilaRosterProfesor[];
    expiraEn: Date;
};

// SPEC-379 (D5a): tercer roster que comparte el mismo modelo de sesión —
// una fila = un curso listo para crear. `profesorTitularId` ya está resuelto
// contra la BD del colegio en el validador; el importer solo lo guarda.
const filaCursoJsonSchema = z.object({
    nombre: z.string(),
    grado: z.string().nullable(),
    anioLectivo: z.string().nullable(),
    profesorTitularId: z.string().nullable(),
});
const filasRosterCursosSchema = z.array(filaCursoJsonSchema);

export type FilaRosterCurso = z.infer<typeof filaCursoJsonSchema>;

export type SesionRosterCursos = {
    id: string;
    colegioId: string;
    filas: FilaRosterCurso[];
    expiraEn: Date;
};

export type SesionRoster = {
    id: string;
    colegioId: string;
    filas: FilaCargaEstudiante[];
    expiraEn: Date;
};

export class CargaRosterSesionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Persiste el roster validado y devuelve el id de sesión (expira en 15 min). */
    async crear(colegioId: string, filas: FilaCargaEstudiante[]): Promise<string> {
        const expiraEn = new Date(Date.now() + TTL_MINUTOS * 60 * 1000);
        const sesion = await this.db.cargaRosterSesion.create({
            data: { colegioId, filas: aJson(filas), expiraEn },
        });
        return sesion.id;
    }

    /**
     * Lee la sesión aplicando las guardas: existe, no vencida y del MISMO colegio
     * (aislamiento multi-tenant). Devuelve null si no pasa alguna guarda.
     */
    async obtenerValida(sesionId: string, colegioId: string): Promise<SesionRoster | null> {
        const sesion = await this.db.cargaRosterSesion.findUnique({ where: { id: sesionId } });
        if (!sesion) return null;
        if (sesion.colegioId !== colegioId) return null;
        if (sesion.expiraEn <= new Date()) return null;
        return {
            id: sesion.id,
            colegioId: sesion.colegioId,
            filas: filasRosterSchema.parse(sesion.filas),
            expiraEn: sesion.expiraEn,
        };
    }

    /**
     * SPEC-344: variante para el roster de PROFESORES (mismas guardas, otro
     * shape). Devuelve null si no existe, es de otro colegio o venció.
     */
    async obtenerValidaProfesores(
        sesionId: string,
        colegioId: string,
    ): Promise<SesionRosterProfesores | null> {
        const sesion = await this.db.cargaRosterSesion.findUnique({ where: { id: sesionId } });
        if (!sesion) return null;
        if (sesion.colegioId !== colegioId) return null;
        if (sesion.expiraEn <= new Date()) return null;
        return {
            id: sesion.id,
            colegioId: sesion.colegioId,
            filas: filasRosterProfesoresSchema.parse(sesion.filas),
            expiraEn: sesion.expiraEn,
        };
    }

    /**
     * SPEC-379 (D5a): variante para el roster de CURSOS. Mismas guardas que
     * `obtenerValida` / `obtenerValidaProfesores`; el shape que valida Zod es
     * el del `CursoNormalizado` del validador de cursos (profesorTitularId ya
     * resuelto contra la BD del colegio).
     */
    async obtenerValidaCursos(
        sesionId: string,
        colegioId: string,
    ): Promise<SesionRosterCursos | null> {
        const sesion = await this.db.cargaRosterSesion.findUnique({ where: { id: sesionId } });
        if (!sesion) return null;
        if (sesion.colegioId !== colegioId) return null;
        if (sesion.expiraEn <= new Date()) return null;
        return {
            id: sesion.id,
            colegioId: sesion.colegioId,
            filas: filasRosterCursosSchema.parse(sesion.filas),
            expiraEn: sesion.expiraEn,
        };
    }

    /** Lectura mínima por id (resolver el tenant antes del consumo single-use). */
    obtenerPorId(sesionId: string) {
        return this.db.cargaRosterSesion.findUnique({
            where: { id: sesionId },
            select: { id: true, colegioId: true },
        });
    }

    /**
     * Borra la sesión (single-use, O-2) acotada al tenant. Debe correr dentro de
     * la tx del import (inyectar el repo con la tx). 404 si no existe o es ajena.
     */
    async consumir(colegioId: string, sesionId: string): Promise<void> {
        const { count } = await this.db.cargaRosterSesion.deleteMany({
            where: { id: sesionId, colegioId },
        });
        if (count === 0) {
            throw new AppError("La validación expiró o no existe; vuelve a validar el archivo", ERROR_CODES.NOT_FOUND, 404);
        }
    }

    /** Limpieza backstop (EXCEPCIÓN sin tenant): borra sesiones vencidas de todos los colegios. */
    async purgarExpiradas(): Promise<number> {
        const resultado = await this.db.cargaRosterSesion.deleteMany({
            where: { expiraEn: { lt: new Date() } },
        });
        return resultado.count;
    }
}
