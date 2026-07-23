import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { canonizarCategoria } from "@/lib/simulacion/metricas";
import { RolUsuario } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.string().min(1);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_simulaciones");
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

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)));

        const run = await prisma.simulacionRun.findUnique({ where: { id: parsedId.data } });
        if (!run) {
            throw new AppError("Simulación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const [items, total] = await prisma.$transaction([
            prisma.simulacionReporte.findMany({
                where: { simulacionRunId: run.id },
                orderBy: { indice: "asc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.simulacionReporte.count({ where: { simulacionRunId: run.id } }),
        ]);

        const reporteIds = items.map((i) => i.reporteId);
        const [reportes, clasificaciones] = await Promise.all([
            prisma.reporte.findMany({ where: { id: { in: reporteIds } }, select: { id: true, identificador: true, estado: true } }),
            prisma.clasificacionIA.findMany({
                where: { reporteId: { in: reporteIds } },
                select: { reporteId: true, categoria: true, confianza: true, latenciaMs: true, modeloUsado: true },
            }),
        ]);

        const reporteMap = new Map(reportes.map((r) => [r.id, r]));
        const clasifMap = new Map(clasificaciones.map((c) => [c.reporteId, c]));

        const resultados = items.map((rel) => {
            const rep = reporteMap.get(rel.reporteId);
            const clasif = clasifMap.get(rel.reporteId);
            const esperado = canonizarCategoria(rel.categoriaEsperada);
            const asignado = clasif ? String(clasif.categoria) : "DESCONOCIDA";
            let acierto: boolean | null = null;
            if (rel.categoriaEsperada && esperado !== "DESCONOCIDA") {
                acierto = esperado === asignado;
            }

            return {
                indice: rel.indice,
                identificador: rep?.identificador ?? "",
                reporteId: rel.reporteId,
                estado: rep?.estado ?? "DESCONOCIDO",
                categoriaEsperada: rel.categoriaEsperada ?? null,
                categoriaAsignada: asignado,
                confianza: clasif?.confianza ?? null,
                latenciaMs: clasif?.latenciaMs ?? null,
                modeloUsado: clasif?.modeloUsado ?? null,
                acierto,
            };
        });

        return NextResponse.json({
            items: resultados,
            pagination: { page, totalPages: Math.ceil(total / pageSize), total },
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
