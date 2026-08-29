import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/admin/colegios/[id]/cursos (SPEC-141, N-1, FR-002).
 * Visibilidad de SOPORTE, estrictamente solo lectura: cursos del colegio con
 * conteo de alumnos, leyendo SOLO por los repos del DAL (tenant obligatorio).
 * Sin guard de vigencia (decisión documentada: `verificarVigenciaColegio`
 * protege el servicio contratado del SCHOOL_ADMIN; el soporte de plataforma
 * consulta también el histórico). Sin auditoría obligatoria: la lista de
 * cursos no expone identificadores ni datos de menores (FR-004 cubre círculo
 * y alumnos).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const colegioId = parsedId.data;

        const colegio = await new ColegioRepository().obtenerResumen(colegioId);
        if (!colegio) {
            return NextResponse.json(
                { error: { message: "Colegio no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const cursos = await new CursoRepository().listarActivos(colegioId);
        const conteos = await new EstudianteRepository().contarPorCursoIds(
            colegioId,
            cursos.map((c) => c.id)
        );

        return NextResponse.json({
            cursos: cursos.map((c) => ({
                id: c.id,
                nombre: c.nombre,
                grado: c.grado,
                anioLectivo: c.anioLectivo,
                estado: c.estado,
                alumnos: conteos.get(c.id) ?? 0,
            })),
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[SoporteLectura] Error consultando cursos del colegio", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
