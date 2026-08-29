import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { ERROR_CODES } from "@/lib/errors";
import { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";
import { TIPOS_ANOMALIA, SEVERIDADES_ANOMALIA } from "@/lib/analisis/anomalias/tipos";

/**
 * SPEC-225 (US3, FR-012): lista paginada de anomalías detectadas (solo ADMIN),
 * ordenada por `detectadaEn` desc. Filtros: `tipo`, `severidad`,
 * `estado=ABIERTAS|RESUELTAS|TODAS` (default ABIERTAS). Contrato:
 * specs/225-deteccion-anomalias/contracts/anomalias-admin.md.
 */

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    tipo: z.enum(TIPOS_ANOMALIA).optional(),
    severidad: z.enum(SEVERIDADES_ANOMALIA).optional(),
    estado: z.enum(["ABIERTAS", "RESUELTAS", "TODAS"]).default("ABIERTAS"),
});

export async function GET(request: Request) {
    try {
        await verifyAuth("ADMIN");

        const url = new URL(request.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: {
                        message: "Parámetros de consulta inválidos",
                        code: ERROR_CODES.VALIDATION_ERROR,
                        details: parsed.error.issues,
                    },
                },
                { status: 400 }
            );
        }

        const { page, pageSize, tipo, severidad, estado } = parsed.data;
        const where: Prisma.AnomaliaWhereInput = {};
        if (tipo) where.tipo = tipo;
        if (severidad) where.severidad = severidad;
        if (estado === "ABIERTAS") where.resueltaEn = null;
        if (estado === "RESUELTAS") where.resueltaEn = { not: null };

        const repo = new AnomaliaRepository();
        try {
            const { items, total } = await repo.listarAnomalias(where, page, pageSize);
            return NextResponse.json({
                disponible: true,
                items,
                pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
            });
        } catch (error) {
            // SPEC-222 (FR-010): degradación elegante si la tabla Anomalia aún no
            // está desplegada en este entorno (Prisma P2021/P2022) — el panel
            // muestra "no disponible" en vez de reventar con 500.
            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                ((error as { code: unknown }).code === "P2021" || (error as { code: unknown }).code === "P2022")
            ) {
                return NextResponse.json({ disponible: false, items: [] });
            }
            throw error;
        }
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/ANOMALIAS]");
    }
}
