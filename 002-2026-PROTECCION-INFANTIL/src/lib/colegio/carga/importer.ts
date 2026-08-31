/**
 * SPEC-134 (E-1): el acceso a datos de la carga masiva vive en los repos del DAL
 * (tenant obligatorio). La lógica de upsert (caché por clave, contadores de
 * creados/reutilizados) queda intacta; los repos se inyectan con la tx (D2).
 */
import type { Prisma } from "@prisma/client";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { IdentificadorEstudianteRepository } from "@/lib/dal/repositories/identificador-estudiante";
import { IdentificadorUnicidadService } from "@/lib/dal/services/identificador-unicidad";
import type { FilaCargaEstudiante } from "./parser";

export type ResumenImportacion = {
    cursosCreados: number;
    cursosReutilizados: number;
    alumnosCreados: number;
    alumnosReutilizados: number;
    identificadoresCreados: number;
    identificadoresReutilizados: number;
    // SPEC-320 (§2.1): identificadores omitidos porque el mismo valor ya pertenece a
    // otra persona del colegio. En carga masiva NO hay quién confirme el override, así
    // que TODA colisión (dura o warn) se omite y se reporta para revisión manual del
    // rector (que puede agregarlo luego por la UI interactiva, con override si aplica).
    identificadoresOmitidosPorConflicto: number;
};

function claveCurso(nombre: string, grado: string | null, anioLectivo: string | null): string {
    return [nombre.toLowerCase(), grado?.toLowerCase() ?? "", anioLectivo?.toLowerCase() ?? ""].join("|");
}

function claveEstudiante(nombre: string, apellidos: string, cursoId: string): string {
    return `${nombre.toLowerCase()}|${apellidos.toLowerCase()}|${cursoId}`;
}

function claveIdentificador(estudianteId: string, tipo: string, valor: string, plataformaId: string | null): string {
    return `${estudianteId}|${tipo.toLowerCase()}|${valor}|${plataformaId ?? ""}`;
}

/**
 * Ejecuta la carga masiva dentro de una transacción Prisma.
 * Hace upsert de curso, alumno e identificador dentro del colegio indicado.
 */
export async function importarCargaMasiva(
    filas: FilaCargaEstudiante[],
    colegioId: string,
    tx?: Prisma.TransactionClient
): Promise<ResumenImportacion> {
    const cursos = new CursoRepository(tx);
    const estudiantes = new EstudianteRepository(tx);
    const identificadores = new IdentificadorEstudianteRepository(tx);

    const resumen: ResumenImportacion = {
        cursosCreados: 0,
        cursosReutilizados: 0,
        alumnosCreados: 0,
        alumnosReutilizados: 0,
        identificadoresCreados: 0,
        identificadoresReutilizados: 0,
        identificadoresOmitidosPorConflicto: 0,
    };

    // Caché en memoria para evitar queries repetidas dentro de la transacción.
    const cursosPorClave = new Map<string, { id: string; creado: boolean }>();
    const estudiantesPorClave = new Map<string, { id: string; creado: boolean }>();
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

        const estudianteKey = claveEstudiante(fila.alumno.nombre, fila.alumno.apellidos, curso.id);
        let estudiante = estudiantesPorClave.get(estudianteKey);
        if (!estudiante) {
            const existente = await estudiantes.buscarPorNombreEnCurso(colegioId, curso.id, fila.alumno.nombre, fila.alumno.apellidos);
            if (existente) {
                estudiante = { id: existente.id, creado: false };
                resumen.alumnosReutilizados++;
            } else {
                const nuevo = await estudiantes.crear(colegioId, {
                    cursoId: curso.id,
                    nombre: fila.alumno.nombre,
                    apellidos: fila.alumno.apellidos,
                });
                estudiante = { id: nuevo.id, creado: true };
                resumen.alumnosCreados++;
            }
            estudiantesPorClave.set(estudianteKey, estudiante);
        }

        const identificadorKey = claveIdentificador(
            estudiante.id,
            fila.identificador.tipo,
            fila.identificador.valor,
            fila.identificador.plataformaId
        );
        let identificador = identificadoresPorClave.get(identificadorKey);
        if (!identificador) {
            const existente = await identificadores.buscarDuplicado(colegioId, {
                estudianteId: estudiante.id,
                tipo: fila.identificador.tipo,
                valor: fila.identificador.valor,
                plataformaId: fila.identificador.plataformaId ?? null,
            });
            if (existente) {
                await identificadores.reactivar(colegioId, existente.id, fila.identificador.etiquetaRelacion);
                identificador = { id: existente.id, creado: false };
                resumen.identificadoresReutilizados++;
                identificadoresPorClave.set(identificadorKey, identificador);
            } else {
                // SPEC-320 (§2.1): en lote no hay override interactivo. Si el valor ya
                // pertenece a OTRA persona del colegio (dura o warn), se OMITE y se
                // reporta; el rector lo resuelve después por la UI. No tumba el batch.
                const colision = await new IdentificadorUnicidadService(tx).clasificarColision(
                    colegioId,
                    fila.identificador.valor,
                    "ESTUDIANTE",
                    { sujeto: "ESTUDIANTE", sujetoId: estudiante.id }
                );
                if (colision.duros.length > 0 || colision.warns.length > 0) {
                    resumen.identificadoresOmitidosPorConflicto++;
                    continue;
                }
                const nuevo = await identificadores.crear(colegioId, {
                    estudianteId: estudiante.id,
                    tipo: fila.identificador.tipo,
                    valor: fila.identificador.valor,
                    plataformaId: fila.identificador.plataformaId ?? null,
                    etiquetaRelacion: fila.identificador.etiquetaRelacion,
                });
                identificador = { id: nuevo.id, creado: true };
                resumen.identificadoresCreados++;
                identificadoresPorClave.set(identificadorKey, identificador);
            }
        } else {
            resumen.identificadoresReutilizados++;
        }
    }

    return resumen;
}
