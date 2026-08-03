import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { logAuditNuevaAccion, ACCION_COLEGIO_ROSTER_ACCESO_ADMIN } from "@/lib/audit-nuevas-acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * GET /api/admin/colegios/[id]/cursos/[cursoId]/alumnos (SPEC-141, N-1, FR-002/FR-004).
 * Visibilidad de SOPORTE, estrictamente solo lectura: alumnos del curso con sus
 * identificadores (paginación estándar). Aislamiento por tenant heredado del
 * DAL: un `cursoId` que no pertenece al colegio de la ruta → 404 (no oráculo).
 * Cada respuesta 200 deja una fila AuditLog (COLEGIO_ROSTER_ACCESO_ADMIN) con
 * metadatos SIN nombres ni valores de identificadores; los 403/404 no auditan.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; cursoId: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "soporte_lectura");

        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: rawId, cursoId: rawCursoId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        const parsedCursoId = idSchema.safeParse(rawCursoId);
        if (!parsedId.success || !parsedCursoId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const colegioId = parsedId.data;
        const cursoId = parsedCursoId.data;

        const url = new URL(request.url);
        const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { page, pageSize } = parsedQuery.data;

        const colegio = await new ColegioRepository().obtenerResumen(colegioId);
        if (!colegio) {
            return NextResponse.json(
                { error: { message: "Colegio no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // 404 si el curso no existe o pertenece a OTRO colegio (aislamiento tenant).
        const curso = await new CursoRepository().obtenerPorId(colegioId, cursoId);
        if (!curso) {
            return NextResponse.json(
                { error: { message: "Curso no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const [alumnos, total] = await new EstudianteRepository().listarPorCursoPaginadosConIdentificadores(
            colegioId,
            cursoId,
            { skip: (page - 1) * pageSize, take: pageSize }
        );

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAuditNuevaAccion({
            accion: ACCION_COLEGIO_ROSTER_ACCESO_ADMIN,
            tipoRecurso: "Colegio",
            recursoId: colegioId,
            usuarioId: admin.id,
            colegioId,
            ipAddress,
            userAgent,
            // Solo claves del acceso — nunca nombres de alumnos ni valores.
            metadatos: { cursoId, page },
        });

        return NextResponse.json({
            items: alumnos.map((a) => ({
                id: a.id,
                nombre: a.nombre,
                estado: a.estado,
                identificadores: a.identificadores.map((i) => ({
                    id: i.id,
                    tipo: i.tipo,
                    valor: i.valor,
                    plataforma: i.plataforma,
                    etiquetaRelacion: i.etiquetaRelacion,
                })),
            })),
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[SoporteLectura] Error consultando alumnos del curso", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
