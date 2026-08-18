import { NextResponse } from "next/server";
import type { EstadoReporte } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { MonitoreoRepository } from "@/lib/dal/repositories/monitoreo";
import { getParametroSistema } from "@/lib/parametros";

const ESTADOS_ATASCABLES = ["PENDIENTE", "PROCESANDO", "REVISION_MANUAL", "REQUIERE_ANONIMIZACION"] as const satisfies readonly EstadoReporte[];

/**
 * GET /api/admin/monitoreo/atascados (SPEC-171, Pilar B)
 * Conteos de reportes "atascados": llevan más de `monitoreo.atascados.horas`
 * horas sin salir de un estado que exige movimiento (cola o revisión). Solo
 * conteos agregados por estado; nunca contenido de reportes.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "estadisticas");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const horasParam = await getParametroSistema("monitoreo.atascados.horas");
        const horasNum = Number(horasParam?.valor);
        const umbralHoras = Number.isFinite(horasNum) && horasNum > 0 ? Math.floor(horasNum) : 24;
        const corte = new Date(Date.now() - umbralHoras * 3_600_000);

        const grupos = await new MonitoreoRepository().conteoAtascados(corte, ESTADOS_ATASCABLES);

        const porEstado: Partial<Record<EstadoReporte, number>> = {
            PENDIENTE: 0,
            PROCESANDO: 0,
            REVISION_MANUAL: 0,
            REQUIERE_ANONIMIZACION: 0,
        };
        const total = grupos.total;
        for (const [estado, conteo] of Object.entries(grupos.porEstado)) {
            porEstado[estado as EstadoReporte] = conteo;
        }

        return NextResponse.json({
            umbralHoras,
            creadoAntesDe: corte.toISOString(),
            porEstado,
            total,
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
