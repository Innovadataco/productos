import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario, type Prisma } from "@prisma/client";
import { getCurrentProductionConfig, type F7Report } from "@/lib/ai/eval-runner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
            throw new AppError("Experimento no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const productionConfig = await getCurrentProductionConfig();
        const snapshot = (run.configSnapshot || {}) as Record<string, unknown>;
        const isBaseline =
            run.estado === "COMPLETADA" &&
            snapshot.modeloClasificacion === productionConfig.modeloClasificacion &&
            snapshot.umbralRevision === productionConfig.umbralRevision &&
            snapshot.nVotos === productionConfig.nVotos &&
            snapshot.temperaturaVotos === productionConfig.temperaturaVotos &&
            snapshot.ragTopK === productionConfig.ragTopK;

        const baseline = isBaseline
            ? null
            : await prisma.evalRun.findFirst({
                  where: {
                      estado: "COMPLETADA",
                      fixtureVersion: run.fixtureVersion,
                      configSnapshot: {
                          equals: productionConfig as unknown as Prisma.InputJsonValue,
                      },
                  },
                  orderBy: { finalizadoEn: "desc" },
              });

        const resultadoJson = run.resultadoJson as unknown as F7Report | null;
        const metrics = resultadoJson?.metrics || null;

        return NextResponse.json({
            experimento: run,
            metrics,
            perCategory: resultadoJson?.perCategory || null,
            operational: resultadoJson?.operational || null,
            baseline: baseline
                ? {
                      id: baseline.id,
                      nombre: baseline.nombre,
                      metrics: (baseline.resultadoJson as unknown as F7Report | null)?.metrics || null,
                  }
                : null,
            baselineMissing: !baseline && run.estado === "COMPLETADA" && !isBaseline,
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
