import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { recalcularYGuardarScore } from "@/lib/scoring";

function requireAdmin(user: { rol: string }) {
    if (String(user.rol) !== "ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        requireAdmin(user);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas confirmaciones. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
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
        const id = parsedId.data;

        const reporte = await prisma.reporte.findUnique({
            where: { id },
            include: { clasificacion: true },
        });
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "No se puede confirmar un reporte dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        if (!reporte.clasificacion) {
            return NextResponse.json(
                { error: { message: "El reporte no tiene clasificación", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const categoria = reporte.clasificacion.categoria;

        const correccionExistente = await prisma.correccionAdmin.findUnique({
            where: { clasificacionId: reporte.clasificacion.id },
        });
        if (correccionExistente) {
            return NextResponse.json(
                { error: { message: "Este reporte ya fue confirmado o corregido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 409 }
            );
        }

        await prisma.correccionAdmin.create({
            data: {
                clasificacionId: reporte.clasificacion.id,
                categoriaOriginal: categoria,
                categoriaCorregida: categoria,
                adminId: user.id,
                confirmada: true,
            },
        });

        // Al confirmar, el reporte pasa a CLASIFICADO y se activan efectos públicos.
        await prisma.reporte.update({
            where: { id },
            data: { estado: "CLASIFICADO" },
        });

        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);
        const scoreResult = await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId);

        return NextResponse.json({
            reporteId: id,
            categoria,
            estado: "CLASIFICADO",
            score: scoreResult.score,
            nivelRiesgo: scoreResult.nivelRiesgo,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
