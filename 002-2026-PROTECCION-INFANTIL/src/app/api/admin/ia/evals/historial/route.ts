import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;

export async function GET(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const fixtureVersion = searchParams.get("fixtureVersion");

        const where = fixtureVersion ? { fixtureVersion: parseInt(fixtureVersion, 10) } : {};

        const [items, total] = await prisma.$transaction([
            prisma.evalRun.findMany({
                where,
                orderBy: { iniciadoEn: "desc" },
                skip: (page - 1) * PAGE_SIZE,
                take: PAGE_SIZE,
                include: { creadoPor: { select: { email: true, nombre: true } } },
            }),
            prisma.evalRun.count({ where }),
        ]);

        const summary = items.map((r) => ({
            id: r.id,
            tipo: r.tipo,
            fixtureVersion: r.fixtureVersion,
            estado: r.estado,
            iniciadoEn: r.iniciadoEn,
            finalizadoEn: r.finalizadoEn,
            error: r.error,
            metricas:
                r.estado === "COMPLETADA" && r.resultadoJson
                    ? {
                          accuracy: (r.resultadoJson as { metrics: { accuracy: number } }).metrics.accuracy,
                          errorSilencioso: (r.resultadoJson as { metrics: { errorSilencioso: number } }).metrics
                              .errorSilencioso,
                          revisionManualRate: (r.resultadoJson as { metrics: { revisionManualRate: number } }).metrics
                              .revisionManualRate,
                      }
                    : null,
            creadoPor: r.creadoPor,
        }));

        return NextResponse.json({
            items: summary,
            pagination: { page, totalPages: Math.ceil(total / PAGE_SIZE), total },
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
