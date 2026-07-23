import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { reactivarReporte } from "@/lib/reporte-lifecycle";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema, reactivarReporteSchema } from "@/lib/validators";

function requireAdmin(user: { rol: string }) {
    if (String(user.rol) !== "ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");
        requireAdmin(user);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas reactivaciones. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
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
        const reporteId = parsedId.data;

        const body = await request.json();
        const parsed = reactivarReporteSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { nota } = parsed.data;

        const result = await reactivarReporte({
            reporteId,
            nota,
            adminId: user.id,
            request,
        });

        return NextResponse.json({
            reporteId: result.reporteId,
            reactivado: result.reactivado,
            embeddingRegenerado: result.embeddingRegenerado,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "REPORTE_NO_ENCONTRADO") {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (msg === "REPORTE_NO_ELIMINADO") {
            return NextResponse.json(
                { error: { message: "El reporte no está dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        if (msg === "EMBEDDING_INCONSISTENTE") {
            return NextResponse.json(
                { error: { message: "El reporte ya tiene embedding activo", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
