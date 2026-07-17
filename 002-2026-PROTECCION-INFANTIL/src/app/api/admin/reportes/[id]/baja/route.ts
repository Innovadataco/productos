import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { darDeBajaReporte } from "@/lib/reporte-lifecycle";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { MotivoBajaReporte } from "@prisma/client";
import { idSchema, darDeBajaReporteSchema } from "@/lib/validators";

function requireAdmin(user: { rol: string }) {
    if (String(user.rol) !== "ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        requireAdmin(user);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas bajas. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
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
        const parsed = darDeBajaReporteSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { motivo, nota } = parsed.data;

        const result = await darDeBajaReporte({
            reporteId,
            motivo: motivo as MotivoBajaReporte,
            nota,
            adminId: user.id,
            request,
        });

        return NextResponse.json({
            reporteId: result.reporteId,
            estadoAnterior: result.estadoAnterior,
            eliminado: result.eliminado,
            datasetPurged: result.datasetPurged,
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
        if (msg === "REPORTE_YA_ELIMINADO") {
            return NextResponse.json(
                { error: { message: "El reporte ya está dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
