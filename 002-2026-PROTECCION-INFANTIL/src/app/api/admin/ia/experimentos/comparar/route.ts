import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario } from "@prisma/client";
import { type F7Report } from "@/lib/ai/eval-runner";
import { z } from "zod";

const compareSchema = z.object({
    ids: z.array(z.string().cuid()).min(2).max(5),
});

function getMetrics(run: { resultadoJson: unknown | null; configSnapshot: unknown | null; fixtureVersion: number; nombre: string | null; id: string }) {
    const report = run.resultadoJson as unknown as F7Report | null;
    return {
        id: run.id,
        nombre: run.nombre,
        fixtureVersion: run.fixtureVersion,
        configSnapshot: run.configSnapshot,
        estado: "COMPLETADA" as const,
        metrics: report?.metrics || null,
        perCategory: report?.perCategory || null,
        operational: report?.operational || null,
    };
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_eval");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = compareSchema.safeParse(body);
        if (!parsed.success) {
            throw new AppError("Se requieren entre 2 y 5 IDs de experimentos", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const runs = await prisma.evalRun.findMany({
            where: { id: { in: parsed.data.ids }, estado: "COMPLETADA" },
            orderBy: { iniciadoEn: "desc" },
        });

        if (runs.length !== parsed.data.ids.length) {
            throw new AppError("Uno o más experimentos no existen o no están completados", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const fixtureVersions = new Set(runs.map((r) => r.fixtureVersion));
        if (fixtureVersions.size > 1) {
            return NextResponse.json(
                {
                    error: {
                        message: "No se pueden comparar experimentos de distintas fixtureVersion",
                        code: ERROR_CODES.VALIDATION_ERROR,
                    },
                    comparable: false,
                    fixtureVersions: Array.from(fixtureVersions),
                },
                { status: 400 }
            );
        }

        // Fronteras: casos donde un experimento acierta y otro falla.
        const resultados = await prisma.evalResultado.findMany({
            where: { experimentoId: { in: parsed.data.ids } },
            select: { experimentoId: true, casoEvalId: true, correcto: true, esperado: true, predicho: true },
        });

        const byCaso = new Map<string, Record<string, boolean>>();
        for (const r of resultados) {
            if (!byCaso.has(r.casoEvalId)) byCaso.set(r.casoEvalId, {});
            byCaso.get(r.casoEvalId)![r.experimentoId] = r.correcto;
        }

        const frontier: Array<{ casoEvalId: string; resultados: Record<string, boolean> }> = [];
        for (const [casoEvalId, map] of byCaso.entries()) {
            const values = Object.values(map);
            if (values.some((v) => v) && values.some((v) => !v)) {
                frontier.push({ casoEvalId, resultados: map });
            }
        }

        return NextResponse.json({
            comparable: true,
            fixtureVersion: runs[0].fixtureVersion,
            experimentos: runs.map(getMetrics),
            frontier: frontier.slice(0, 100),
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
