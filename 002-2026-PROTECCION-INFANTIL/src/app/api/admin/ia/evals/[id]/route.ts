import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_eval");
        const { id } = await context.params;

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const run = await prisma.evalRun.findUnique({
            where: { id },
            include: { creadoPor: { select: { email: true, nombre: true } } },
        });
        if (!run) {
            throw new AppError("Corrida no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        // Comparación con la corrida anterior de la misma fixtureVersion
        let comparacion = null;
        if (run.estado === "COMPLETADA" && run.resultadoJson) {
            const anterior = await prisma.evalRun.findFirst({
                where: {
                    id: { not: run.id },
                    fixtureVersion: run.fixtureVersion,
                    estado: "COMPLETADA",
                },
                orderBy: { finalizadoEn: "desc" },
            });
            if (anterior?.resultadoJson) {
                const actual = run.resultadoJson as unknown as { metrics: RunMetrics };
                const prev = anterior.resultadoJson as unknown as { metrics: RunMetrics };
                comparacion = {
                    accuracyDelta: actual.metrics.accuracy - prev.metrics.accuracy,
                    errorSilenciosoDelta: actual.metrics.errorSilencioso - prev.metrics.errorSilencioso,
                    revisionManualRateDelta: actual.metrics.revisionManualRate - prev.metrics.revisionManualRate,
                    anteriorId: anterior.id,
                    anteriorFinalizadoEn: anterior.finalizadoEn,
                };
            }
        }

        return NextResponse.json({ run, comparacion });
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

interface RunMetrics {
    accuracy: number;
    errorSilencioso: number;
    revisionManualRate: number;
}
