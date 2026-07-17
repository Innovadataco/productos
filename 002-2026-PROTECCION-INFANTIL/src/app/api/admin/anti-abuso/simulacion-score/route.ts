import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { calcularScore, determinarNivelRiesgo } from "@/lib/scoring";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { NivelRiesgo } from "@/lib/scoring";

const PAGE_SIZE = 50;

export interface SimulacionScoreItem {
    identificador: string;
    plataformaId: string;
    plataformaNombre: string;
    score: number;
    scoreAjustado: number;
    nivelActual: NivelRiesgo;
    nivelAjustado: NivelRiesgo;
    cambioNivel: number; // +1 subida, -1 bajada, 0 igual
    pesoAnonimoPromedio: number;
    pesoAutenticadoPromedio: number;
    totalReportes: number;
    reportesAnonimos: number;
    reportesAutenticados: number;
}

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        if (String(user.rol) !== "ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

        const [totalItems, identificadores] = await Promise.all([
            prisma.identificadorReportado.count(),
            prisma.identificadorReportado.findMany({
                skip: (page - 1) * PAGE_SIZE,
                take: PAGE_SIZE,
                orderBy: { ultimoReporteEn: "desc" },
                select: { id: true, identificador: true, plataformaId: true },
            }),
        ]);

        const plataformaIds = [...new Set(identificadores.map((i) => i.plataformaId).filter(Boolean))];
        const plataformas = await prisma.plataforma.findMany({
            where: { id: { in: plataformaIds } },
            select: { id: true, nombre: true },
        });
        const plataformaNombrePorId = Object.fromEntries(plataformas.map((p) => [p.id, p.nombre]));

        const detalles: SimulacionScoreItem[] = [];
        let subidas = 0;
        let bajadas = 0;

        for (const row of identificadores) {
            const resultado = await calcularScore(row.identificador, row.plataformaId, undefined, { forceSourceWeight: true });
            const nivelActual = determinarNivelRiesgo(resultado.score, {
                low: 35,
                medium: 60,
                high: 80,
            });
            const nivelAjustado = determinarNivelRiesgo(resultado.scoreAjustado, {
                low: 35,
                medium: 60,
                high: 80,
            });

            const niveles: NivelRiesgo[] = ["BAJO", "MEDIO", "ALTO", "CRITICO"];
            const cambioNivel = niveles.indexOf(nivelAjustado) - niveles.indexOf(nivelActual);
            if (cambioNivel > 0) subidas++;
            if (cambioNivel < 0) bajadas++;

            detalles.push({
                identificador: row.identificador,
                plataformaId: row.plataformaId,
                plataformaNombre: plataformaNombrePorId[row.plataformaId] || "Desconocida",
                score: resultado.score,
                scoreAjustado: resultado.scoreAjustado,
                nivelActual,
                nivelAjustado,
                cambioNivel,
                pesoAnonimoPromedio: resultado.pesoAnonimoPromedio,
                pesoAutenticadoPromedio: resultado.pesoAutenticadoPromedio,
                totalReportes: resultado.totalReportes,
                reportesAnonimos: resultado.reportesAnonimos,
                reportesAutenticados: resultado.reportesAutenticados,
            });
        }

        return NextResponse.json({
            resumen: {
                totalItems,
                totalPages: Math.ceil(totalItems / PAGE_SIZE),
                currentPage: page,
                subidas,
                bajadas,
                sinCambio: detalles.length - subidas - bajadas,
            },
            detalles,
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
