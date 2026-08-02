/**
 * SPEC-134 (E-1): el acceso a datos de la carga masiva vive en los repos del DAL
 * (tenant obligatorio). La lógica de upsert (caché por clave, contadores de
 * creados/reutilizados) queda intacta; los repos se inyectan con la tx (D2).
 */
import type { Prisma } from "@prisma/client";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { AlumnoRepository } from "@/lib/dal/repositories/alumno";
import { IdentificadorAlumnoRepository } from "@/lib/dal/repositories/identificador-alumno";
import type { FilaCargaAlumno } from "./parser";

export type ResumenImportacion = {
    cursosCreados: number;
    cursosReutilizados: number;
    alumnosCreados: number;
    alumnosReutilizados: number;
    identificadoresCreados: number;
    identificadoresReutilizados: number;
};

function claveCurso(nombre: string, grado: string | null, anioLectivo: string | null): string {
    return [nombre.toLowerCase(), grado?.toLowerCase() ?? "", anioLectivo?.toLowerCase() ?? ""].join("|");
}

function claveAlumno(nombre: string, cursoId: string): string {
    return `${nombre.toLowerCase()}|${cursoId}`;
}

function claveIdentificador(alumnoId: string, tipo: string, valor: string, plataformaId: string | null): string {
    return `${alumnoId}|${tipo.toLowerCase()}|${valor}|${plataformaId ?? ""}`;
}

/**
 * Ejecuta la carga masiva dentro de una transacción Prisma.
 * Hace upsert de curso, alumno e identificador dentro del colegio indicado.
 */
export async function importarCargaMasiva(
    filas: FilaCargaAlumno[],
    colegioId: string,
    tx?: Prisma.TransactionClient
): Promise<ResumenImportacion> {
    const cursos = new CursoRepository(tx);
    const alumnos = new AlumnoRepository(tx);
    const identificadores = new IdentificadorAlumnoRepository(tx);

    const resumen: ResumenImportacion = {
        cursosCreados: 0,
        cursosReutilizados: 0,
        alumnosCreados: 0,
        alumnosReutilizados: 0,
        identificadoresCreados: 0,
        identificadoresReutilizados: 0,
    };

    // Caché en memoria para evitar queries repetidas dentro de la transacción.
    const cursosPorClave = new Map<string, { id: string; creado: boolean }>();
    const alumnosPorClave = new Map<string, { id: string; creado: boolean }>();
    const identificadoresPorClave = new Map<string, { id: string; creado: boolean }>();

    for (const fila of filas) {
        const cursoKey = claveCurso(fila.curso.nombre, fila.curso.grado, fila.curso.anioLectivo);
        let curso = cursosPorClave.get(cursoKey);
        if (!curso) {
            const existente = await cursos.buscarPorDatos(colegioId, {
                nombre: fila.curso.nombre,
                grado: fila.curso.grado ?? null,
                anioLectivo: fila.curso.anioLectivo ?? null,
            });
            if (existente) {
                curso = { id: existente.id, creado: false };
                resumen.cursosReutilizados++;
            } else {
                const nuevo = await cursos.crear(colegioId, {
                    nombre: fila.curso.nombre,
                    grado: fila.curso.grado,
                    anioLectivo: fila.curso.anioLectivo,
                });
                curso = { id: nuevo.id, creado: true };
                resumen.cursosCreados++;
            }
            cursosPorClave.set(cursoKey, curso);
        }

        const alumnoKey = claveAlumno(fila.alumno.nombre, curso.id);
        let alumno = alumnosPorClave.get(alumnoKey);
        if (!alumno) {
            const existente = await alumnos.buscarPorNombreEnCurso(colegioId, curso.id, fila.alumno.nombre);
            if (existente) {
                alumno = { id: existente.id, creado: false };
                resumen.alumnosReutilizados++;
            } else {
                const nuevo = await alumnos.crear(colegioId, { cursoId: curso.id, nombre: fila.alumno.nombre });
                alumno = { id: nuevo.id, creado: true };
                resumen.alumnosCreados++;
            }
            alumnosPorClave.set(alumnoKey, alumno);
        }

        const identificadorKey = claveIdentificador(
            alumno.id,
            fila.identificador.tipo,
            fila.identificador.valor,
            fila.identificador.plataformaId
        );
        let identificador = identificadoresPorClave.get(identificadorKey);
        if (!identificador) {
            const existente = await identificadores.buscarDuplicado(colegioId, {
                alumnoId: alumno.id,
                tipo: fila.identificador.tipo,
                valor: fila.identificador.valor,
                plataformaId: fila.identificador.plataformaId ?? null,
            });
            if (existente) {
                await identificadores.reactivar(colegioId, existente.id, fila.identificador.etiquetaRelacion);
                identificador = { id: existente.id, creado: false };
                resumen.identificadoresReutilizados++;
            } else {
                const nuevo = await identificadores.crear(colegioId, {
                    alumnoId: alumno.id,
                    tipo: fila.identificador.tipo,
                    valor: fila.identificador.valor,
                    plataformaId: fila.identificador.plataformaId ?? null,
                    etiquetaRelacion: fila.identificador.etiquetaRelacion,
                });
                identificador = { id: nuevo.id, creado: true };
                resumen.identificadoresCreados++;
            }
            identificadoresPorClave.set(identificadorKey, identificador);
        } else {
            resumen.identificadoresReutilizados++;
        }
    }

    return resumen;
}
