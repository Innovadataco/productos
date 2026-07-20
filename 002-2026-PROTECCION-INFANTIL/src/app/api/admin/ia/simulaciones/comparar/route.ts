import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { calcularMetricasSimulacion, canonizarCategoria } from "@/lib/simulacion/metricas";
import { RolUsuario } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
    ids: z.array(z.string().min(1)).min(2).max(5),
});

export async function POST(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            throw new AppError(first?.message || "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const ids = parsed.data.ids;
        const runs = await prisma.simulacionRun.findMany({
            where: { id: { in: ids } },
            orderBy: { fechaInicio: "asc" },
        });
        if (runs.length !== ids.length) {
            throw new AppError("Una o más simulaciones no encontradas", ERROR_CODES.NOT_FOUND, 404);
        }

        const metricasRuns = await Promise.all(
            runs.map(async (run) => ({
                run,
                metricas: await calcularMetricasSimulacion(run.id),
            }))
        );

        const resultadosPorIndice: Record<number, Array<{
            runId: string;
            modelo: string;
            identificador: string;
            categoriaEsperada: string | null;
            categoriaAsignada: string;
            confianza: number | null;
            estado: string;
            acierto: boolean | null;
        }>> = {};

        for (const { run, metricas } of metricasRuns) {
            const relacionados = await prisma.simulacionReporte.findMany({
                where: { simulacionRunId: run.id },
                orderBy: { indice: "asc" },
            });
            const reportes = await prisma.reporte.findMany({
                where: { id: { in: relacionados.map((r) => r.reporteId) } },
                select: { id: true, identificador: true, estado: true },
            });
            const clasificaciones = await prisma.clasificacionIA.findMany({
                where: { reporteId: { in: relacionados.map((r) => r.reporteId) } },
                select: { reporteId: true, categoria: true, confianza: true },
            });
            const reporteMap = new Map(reportes.map((r) => [r.id, r]));
            const clasifMap = new Map(clasificaciones.map((c) => [c.reporteId, c]));

            for (const rel of relacionados) {
                const rep = reporteMap.get(rel.reporteId);
                const clasif = clasifMap.get(rel.reporteId);
                const esperado = canonizarCategoria(rel.categoriaEsperada);
                const asignado = clasif ? String(clasif.categoria) : "DESCONOCIDA";
                const acierto = rel.categoriaEsperada && esperado !== "DESCONOCIDA" ? esperado === asignado : null;

                if (!resultadosPorIndice[rel.indice]) {
                    resultadosPorIndice[rel.indice] = [];
                }
                resultadosPorIndice[rel.indice].push({
                    runId: run.id,
                    modelo: run.modelo,
                    identificador: rep?.identificador ?? "",
                    categoriaEsperada: rel.categoriaEsperada ?? null,
                    categoriaAsignada: asignado,
                    confianza: clasif?.confianza ?? null,
                    estado: rep?.estado ?? "DESCONOCIDO",
                    acierto,
                });
            }
        }

        const indices = Object.keys(resultadosPorIndice).map(Number).sort((a, b) => a - b);
        const filas = indices.map((indice) => ({
            indice,
            resultados: resultadosPorIndice[indice],
        }));

        const resumen = metricasRuns.map(({ run, metricas }) => ({
            id: run.id,
            modelo: run.modelo,
            totalCasos: metricas.totalCasos,
            aciertos: metricas.aciertos,
            fallos: metricas.fallos,
            accuracy: metricas.accuracy,
            latenciaP50Ms: metricas.latenciaP50Ms,
            latenciaP95Ms: metricas.latenciaP95Ms,
            distribucionEstados: metricas.distribucionEstados,
        }));

        const advertencia =
            runs.some((r) => r.totalCasos !== runs[0].totalCasos) ?
                "Las corridas tienen diferente cantidad de casos; la comparación solo incluye índices presentes en ambas." :
                undefined;

        return NextResponse.json({
            runs: resumen,
            filas,
            advertencia,
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
