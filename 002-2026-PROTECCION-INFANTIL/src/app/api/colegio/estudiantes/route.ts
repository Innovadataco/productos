/**
 * SPEC-931 · GET /api/colegio/estudiantes — listado del COLEGIO (Usuarios → Estudiantes).
 *
 * Hasta hoy los estudiantes solo se listaban por curso. Mismo contrato de acceso que Profesores
 * (su hermano en «Usuarios»): SCHOOL_ADMIN + módulo `colegios_gestion` + vigencia + rate limit.
 *
 * PERTENENCIA (patrón SPEC-891): el colegio SIEMPRE sale de la sesión —`user.colegioId`, que
 * `verifyAuth` relee de la BD—, nunca de un parámetro del cliente. `cursoId` solo ACOTA dentro de
 * ese colegio: un curso de otro colegio devuelve una lista vacía, jamás sus estudiantes.
 *
 * Respuesta `{ items, pagination }` con DTO explícito (`aEstudianteListado`): id, nombre, curso y
 * conteos de identificadores activos y acudientes — sin documento ni contactos.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { estudiantesColegioQuerySchema } from "@/lib/schemas/estudiantes-colegio";
import { aEstudianteListado } from "@/lib/colegio/estudiantes-listado";

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegioSalvoCamino(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
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

        const url = new URL(request.url);
        const parsed = estudiantesColegioQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { page, pageSize, q, cursoId } = parsed.data;

        // El colegio es el de la SESIÓN (pertenencia); el filtro del cliente solo acota dentro de él.
        const [filas, total] = await new EstudianteRepository().listarDelColegio(user.colegioId, {
            busqueda: q,
            cursoId,
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        return NextResponse.json({
            items: filas.map(aEstudianteListado),
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/ESTUDIANTES]");
    }
}
