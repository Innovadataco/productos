import { NextResponse } from "next/server";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import { verifyAuth } from "@/lib/auth";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { ProfesorRepository } from "@/lib/dal/repositories/profesor";
import { IdentificadorEstudianteRepository } from "@/lib/dal/repositories/identificador-estudiante";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation, ValidationError } from "@/lib/validation";
import { payloadUnificadoSchema } from "@/lib/schemas";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { inferirTipoIdentificador, normalizarIdentificador } from "@/lib/colegio/normalizacion";
import { IdentificadorUnicidadService } from "@/lib/dal/services/identificador-unicidad";

/**
 * SPEC-146 (FR-002) — POST /api/colegio/cursos/unificado: crea curso +
 * estudiantes (con acudientes) + identificadores en UNA transacción
 * (`withUnitOfWork`, SPEC-137): todo o nada. Si algo falla a mitad (duplicado,
 * profesor ajeno, …) la BD vuelve a cero — nunca un curso huérfano ni
 * estudiantes sin curso. Tenant-first en cada entidad (E-1): todo se persiste
 * con el `colegioId` de sesión y el titular se valida same-tenant (SPEC-145).
 */

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        const colegioId = user.colegioId;

        // Defensa en profundidad (FR-002): la dry-run del cliente nunca es de
        // confianza — TODO se re-valida con Zod server-side y el 400 lleva el
        // mensaje humano de la primera issue (§4.6).
        const body = await withValidation.body(payloadUnificadoSchema)(request).catch((error: unknown) => {
            if (error instanceof ValidationError) {
                throw new AppError(error.details[0]?.message ?? "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
            }
            throw error;
        });

        const { ipAddress, userAgent } = getClientInfo(request);

        const resultado = await withUnitOfWork(async (tx) => {
            const cursos = new CursoRepository(tx);
            const estudiantes = new EstudianteRepository(tx);
            const profesores = new ProfesorRepository(tx);
            const identificadores = new IdentificadorEstudianteRepository(tx);

            // 1. Profesor titular: existente same-tenant (404 si es de OTRO
            // colegio — propiedad cross-tenant) o nuevo inline (409 si ya hay
            // uno activo con ese nombre: se sugiere usar el existente).
            let profesorTitularId: string | null = null;
            let profesorCreado = false;
            if (body.profesorNuevo) {
                // SPEC-320 (§2.2): la identidad del profesor es obligatoria (documento,
                // año de nacimiento, sexo, email, teléfono). El alta rápida del wizard solo
                // trae nombre+apellidos, así que ya NO puede crear el profesor inline: hay
                // que darlo de alta con identidad completa en la ficha de profesor y luego
                // elegirlo aquí de la lista. (La ficha completa en el wizard es SPEC-B.)
                throw new AppError(
                    "Para agregar un profesor nuevo, créalo primero en la sección de Profesores con su documento e identidad completa; luego elígelo de la lista aquí.",
                    ERROR_CODES.VALIDATION_ERROR,
                    400
                );
            } else if (body.curso.profesorTitularId) {
                const titular = await profesores.obtenerPorId(colegioId, body.curso.profesorTitularId);
                if (!titular) {
                    throw new AppError("No encontramos a ese profesor en tu colegio", ERROR_CODES.NOT_FOUND, 404);
                }
                profesorTitularId = titular.id;
            }

            // 2. Curso: duplicado (nombre+grado+año) → 409 con mensaje humano.
            const duplicadoCurso = await cursos.buscarPorDatos(colegioId, {
                nombre: body.curso.nombre,
                grado: body.curso.grado ?? null,
                anioLectivo: body.curso.anioLectivo ?? null,
            });
            if (duplicadoCurso) {
                throw new AppError("Ya existe un curso con ese nombre", ERROR_CODES.CONFLICT, 409);
            }
            const curso = await cursos.crear(colegioId, {
                nombre: body.curso.nombre,
                grado: body.curso.grado,
                anioLectivo: body.curso.anioLectivo,
                profesorTitularId,
            });

            // 3. Estudiantes (con acudientes anidados, create atómico por
            // estudiante — D1 de SPEC-144). El duplicado se busca DENTRO de la
            // tx: también detecta repetidos del propio payload.
            const idsEstudiantes: string[] = [];
            for (const datos of body.estudiantes) {
                const duplicado = await estudiantes.buscarPorNombreEnCurso(colegioId, curso.id, datos.nombre, datos.apellidos);
                if (duplicado) {
                    throw new AppError(
                        `${datos.nombre} ${datos.apellidos} ya está en este curso (o viene repetido en la lista)`,
                        ERROR_CODES.CONFLICT,
                        409
                    );
                }
                const creado = await estudiantes.crear(colegioId, {
                    cursoId: curso.id,
                    nombre: datos.nombre,
                    apellidos: datos.apellidos,
                    documentoTipo: datos.documentoTipo,
                    documentoNumero: datos.documentoNumero,
                    acudientes: datos.acudientes,
                });
                idsEstudiantes.push(creado.id);
            }

            // 4. Identificadores: tipo inferido si falta, valor normalizado,
            // duplicado (estudiante+tipo+valor+plataforma) → 409. La búsqueda
            // dentro de la tx también detecta repetidos del propio payload.
            let identificadoresCreados = 0;
            for (const datos of body.identificadores) {
                const estudianteId = idsEstudiantes[datos.estudianteIndex]!;
                const tipo = datos.tipo ?? inferirTipoIdentificador(datos.valor);
                const valor = normalizarIdentificador(datos.valor, tipo);
                const duplicado = await identificadores.buscarDuplicado(colegioId, {
                    estudianteId,
                    tipo,
                    valor,
                    plataformaId: datos.plataformaId ?? null,
                });
                if (duplicado) {
                    throw new AppError(
                        "Ese identificador ya está registrado para este estudiante",
                        ERROR_CODES.CONFLICT,
                        409
                    );
                }
                // SPEC-320 (§2.1): el wizard atómico enforce integridad. El override
                // interactivo por identificador vive en la UI (SPEC-B / 002-PI-221),
                // fuera de este alcance; acá cualquier colisión cross-sujeto o dura
                // aborta con mensaje claro para que el rector la resuelva.
                const colision = await new IdentificadorUnicidadService(tx).clasificarColision(
                    colegioId,
                    valor,
                    "ESTUDIANTE",
                    { sujeto: "ESTUDIANTE", sujetoId: estudianteId }
                );
                const otro = colision.duros[0] ?? colision.warns[0];
                if (otro) {
                    throw new AppError(
                        `Este identificador ya pertenece a ${otro.nombre} (${otro.rol}) de este colegio`,
                        ERROR_CODES.CONFLICT,
                        409
                    );
                }
                await identificadores.crear(colegioId, {
                    estudianteId,
                    tipo,
                    valor,
                    plataformaId: datos.plataformaId ?? null,
                    etiquetaRelacion: datos.etiquetaRelacion ?? "ESTUDIANTE",
                });
                identificadoresCreados++;
            }

            // 5. Auditoría histórica (metadatos solamente — §3.5) en la MISMA tx.
            await logAudit({
                accion: "COLEGIO_CURSO_CREADO",
                tipoRecurso: "Curso",
                recursoId: curso.id,
                usuarioId: user.id,
                colegioId,
                valorNuevo: JSON.stringify({
                    nombre: body.curso.nombre,
                    grado: body.curso.grado ?? null,
                    anioLectivo: body.curso.anioLectivo ?? null,
                    profesorTitularId,
                    estudiantesCreados: idsEstudiantes.length,
                    identificadoresCreados,
                    profesorCreado,
                    colegioId,
                }),
                ipAddress,
                userAgent,
                tx,
            });

            return {
                curso,
                resumen: {
                    estudiantesCreados: idsEstudiantes.length,
                    identificadoresCreados,
                    profesorCreado,
                },
            };
        });

        const res = NextResponse.json(resultado, { status: 201 });
        // SPEC-344 (A-69 · C1 · Phase 9-bis): sellar cookie — el wizard cierra
        // simultáneamente los pasos Cursos y Estudiantes del camino.
        await sellarCookieSesionEstado(res, user.id);
        return res;
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/CURSOS-UNIFICADO]");
    }
}
