/**
 * SPEC-152: servicio de duplicación de curso al año siguiente.
 * Clona un curso propio con sus estudiantes e identificadores activos de forma
 * atómica (`withUnitOfWork`). El profesor titular NO se copia.
 */
import type { Prisma } from "@prisma/client";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { IdentificadorEstudianteRepository } from "@/lib/dal/repositories/identificador-estudiante";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { normalizarIdentificador, inferirTipoIdentificador } from "@/lib/colegio/normalizacion";

function calcularAnioLectivoSiguiente(anioLectivo: string | null | undefined): string {
    if (anioLectivo) {
        const numero = Number(anioLectivo);
        if (!Number.isNaN(numero)) {
            return String(numero + 1);
        }
    }
    return String(new Date().getFullYear() + 1);
}

export interface DuplicarCursoInput {
    colegioId: string;
    cursoOrigenId: string;
    usuarioId: string;
    ipAddress: string;
    userAgent: string;
}

export interface DuplicarCursoResultado {
    curso: Prisma.CursoGetPayload<{ include: {} }>;
    resumen: {
        estudiantesClonados: number;
        identificadoresClonados: number;
    };
}

export async function duplicarCurso(input: DuplicarCursoInput): Promise<DuplicarCursoResultado> {
    const { colegioId, cursoOrigenId, usuarioId, ipAddress, userAgent } = input;

    return withUnitOfWork(async (tx) => {
        const cursos = new CursoRepository(tx);
        const estudiantes = new EstudianteRepository(tx);
        const identificadores = new IdentificadorEstudianteRepository(tx);

        // 1. Leer curso origen (tenant-first → 404 si es ajeno).
        const cursoOrigen = await cursos.obtenerPorId(colegioId, cursoOrigenId);
        if (!cursoOrigen) {
            throw new AppError("Curso no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        // 2. Calcular año lectivo destino y verificar duplicado.
        const anioLectivoDestino = calcularAnioLectivoSiguiente(cursoOrigen.anioLectivo);
        const destinoExistente = await cursos.buscarPorDatos(colegioId, {
            nombre: cursoOrigen.nombre,
            grado: cursoOrigen.grado,
            anioLectivo: anioLectivoDestino,
        });
        if (destinoExistente) {
            throw new AppError(
                "Ya existe un curso con ese nombre para el periodo siguiente",
                ERROR_CODES.CONFLICT,
                409
            );
        }

        // 3. Crear curso destino sin profesor titular.
        const cursoDestino = await cursos.crear(colegioId, {
            nombre: cursoOrigen.nombre,
            grado: cursoOrigen.grado,
            anioLectivo: anioLectivoDestino,
            profesorTitularId: null,
        });

        // 4. Leer estudiantes activos del curso origen con acudientes e identificadores.
        const estudiantesOrigen = await estudiantes.listarPorCursoConDetalle(colegioId, cursoOrigenId);

        let identificadoresClonados = 0;
        for (const origen of estudiantesOrigen) {
            // SPEC-146: mismo criterio de duplicado por nombre+apellidos en el curso.
            const duplicado = await estudiantes.buscarPorNombreEnCurso(
                colegioId,
                cursoDestino.id,
                origen.nombre,
                origen.apellidos
            );
            if (duplicado) {
                throw new AppError(
                    `${origen.nombre} ${origen.apellidos} ya está en el curso destino`,
                    ERROR_CODES.CONFLICT,
                    409
                );
            }

            // SPEC-320 (§2.2-bis + §2.1): PROMOCIÓN. El alumno pasa al curso del año
            // siguiente; su matrícula del año anterior deja de estar activa. Se desactiva
            // el estudiante ORIGEN y sus identificadores ANTES de clonar, para que el
            // documento único por colegio y la unicidad del identificador (índices
            // parciales WHERE estado='activo') vean solo el clon activo — sin choque.
            for (const ident of origen.identificadores) {
                await identificadores.cambiarEstado(colegioId, ident.id, "inactivo");
            }
            await estudiantes.cambiarEstado(colegioId, origen.id, "inactivo");

            const acudientes = origen.acudientes.map((a) => ({
                orden: a.orden as 1 | 2,
                nombre: a.nombre,
                relacion: a.relacion,
                telefono: a.telefono ?? undefined,
                email: a.email ?? undefined,
            }));

            const estudianteNuevo = await estudiantes.crear(colegioId, {
                cursoId: cursoDestino.id,
                nombre: origen.nombre,
                apellidos: origen.apellidos,
                documentoTipo: origen.documentoTipo ?? undefined,
                documentoNumero: origen.documentoNumero ?? undefined,
                acudientes,
            });

            for (const ident of origen.identificadores) {
                const tipo = ident.tipo ?? inferirTipoIdentificador(ident.valor);
                const valor = normalizarIdentificador(ident.valor, tipo);
                await identificadores.crear(colegioId, {
                    estudianteId: estudianteNuevo.id,
                    tipo,
                    valor,
                    plataformaId: ident.plataformaId,
                    etiquetaRelacion: ident.etiquetaRelacion,
                });
                identificadoresClonados++;
            }
        }

        // 5. Auditoría en la misma transacción.
        await logAudit({
            accion: "COLEGIO_CURSO_DUPLICADO",
            tipoRecurso: "Curso",
            recursoId: cursoDestino.id,
            usuarioId,
            colegioId,
            valorNuevo: JSON.stringify({
                cursoOrigenId,
                cursoDestinoId: cursoDestino.id,
                estudiantesClonados: estudiantesOrigen.length,
                identificadoresClonados,
            }),
            ipAddress,
            userAgent,
            tx,
        });

        return {
            curso: cursoDestino,
            resumen: {
                estudiantesClonados: estudiantesOrigen.length,
                identificadoresClonados,
            },
        };
    });
}
