import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { actualizarProgresoYEstado, refrescarMetricasSimulacion } from "@/lib/simulacion/progreso";
import { RolUsuario } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.string().min(1);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        const { id } = await params;
        const parsedId = idSchema.safeParse(id);
        if (!parsedId.success) {
            throw new AppError("ID inválido", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const run = await prisma.simulacionRun.findUnique({
            where: { id: parsedId.data },
            include: { creadoPor: { select: { email: true, nombre: true } } },
        });
        if (!run) {
            throw new AppError("Simulación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const { progreso, estado } = await actualizarProgresoYEstado(run.id);
        if (estado === "COMPLETADA" && !run.metricasJson) {
            await refrescarMetricasSimulacion(run.id);
        }

        const runActualizada = await prisma.simulacionRun.findUnique({
            where: { id: run.id },
            include: { creadoPor: { select: { email: true, nombre: true } } },
        });

        return NextResponse.json(runActualizada);
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
