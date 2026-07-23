import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { calcularMetricasSimulacion, canonizarCategoria } from "@/lib/simulacion/metricas";
import { RolUsuario } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.string().min(1);

function toCsv(rows: Record<string, string | number | boolean | null>[], columns: string[]): string {
    const header = columns.join(",");
    const lines = rows.map((row) =>
        columns
            .map((col) => {
                const val = row[col];
                if (val === null || val === undefined) return "";
                const str = String(val);
                if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            })
            .join(",")
    );
    return [header, ...lines].join("\n");
}

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
        const formato = searchParams.get("formato") || "csv";
        if (!["csv", "json"].includes(formato)) {
            throw new AppError("Formato inválido. Use csv o json", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const run = await prisma.simulacionRun.findUnique({ where: { id: parsedId.data } });
        if (!run) {
            throw new AppError("Simulación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        if (run.estado === "PENDIENTE" || run.estado === "EN_PROGRESO") {
            throw new AppError(
                "La exportación solo está disponible para corridas finalizadas",
                ERROR_CODES.CONFLICT,
                409
            );
        }

        const metricas = await calcularMetricasSimulacion(run.id);

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
            select: { reporteId: true, categoria: true, confianza: true, latenciaMs: true, modeloUsado: true },
        });

        const reporteMap = new Map(reportes.map((r) => [r.id, r]));
        const clasifMap = new Map(clasificaciones.map((c) => [c.reporteId, c]));

        const filas = relacionados.map((rel) => {
            const rep = reporteMap.get(rel.reporteId);
            const clasif = clasifMap.get(rel.reporteId);
            const esperado = canonizarCategoria(rel.categoriaEsperada);
            const asignado = clasif ? String(clasif.categoria) : "DESCONOCIDA";
            const acierto = rel.categoriaEsperada && esperado !== "DESCONOCIDA" ? (esperado === asignado ? "SI" : "NO") : "N/A";
            return {
                indice: rel.indice,
                identificador: rep?.identificador ?? "",
                categoriaEsperada: rel.categoriaEsperada ?? "N/A",
                categoriaAsignada: asignado,
                confianza: clasif?.confianza ?? "N/A",
                estado: rep?.estado ?? "DESCONOCIDO",
                latenciaMs: clasif?.latenciaMs ?? "N/A",
                modeloUsado: clasif?.modeloUsado ?? "N/A",
                acierto,
            };
        });

        if (formato === "json") {
            return NextResponse.json(
                {
                    runId: run.id,
                    modelo: run.modelo,
                    estado: run.estado,
                    totalCasos: run.totalCasos,
                    metricas,
                    casos: filas,
                },
                {
                    headers: {
                        "Content-Disposition": `attachment; filename="simulacion-${run.id.slice(0, 8)}.json"`,
                    },
                }
            );
        }

        const columns = [
            "indice",
            "identificador",
            "categoriaEsperada",
            "categoriaAsignada",
            "confianza",
            "estado",
            "latenciaMs",
            "modeloUsado",
            "acierto",
        ];
        const csv = toCsv(filas, columns);
        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="simulacion-${run.id.slice(0, 8)}.csv"`,
            },
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
