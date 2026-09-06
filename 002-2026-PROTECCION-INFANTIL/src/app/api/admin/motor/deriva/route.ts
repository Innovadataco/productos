import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { leerParametrosDeriva, obtenerBaselineBanco, obtenerUltimoSnapshot } from "@/lib/motor/deriva";

const DIAS_BASELINE_VIEJA = 30;

/**
 * GET /api/admin/motor/deriva (SPEC-172, Pilar D.5)
 * Último snapshot semanal de la deriva del motor (todas las filas de la semana
 * más reciente) + metadatos del baseline del banco + umbrales vigentes. Solo
 * estadísticas agregadas por categoría: cero textos de reportes y cero PII.
 * La ruta no toca prisma (frontera DAL): todo sale de src/lib/motor/deriva.ts.
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

        const [snapshot, baseline, params] = await Promise.all([
            obtenerUltimoSnapshot(),
            obtenerBaselineBanco(),
            leerParametrosDeriva(),
        ]);

        if (!snapshot) {
            return NextResponse.json({
                filas: [],
                sinBaseline: true,
                mensaje:
                    "Todavía no hay medición de deriva: el job corre los lunes 07:00 (America/Bogota) o puede recalcular ahora.",
            });
        }

        const baselineVieja =
            baseline !== null && Date.now() - baseline.fechaFin.getTime() > DIAS_BASELINE_VIEJA * 24 * 60 * 60 * 1000;

        return NextResponse.json({
            semanaInicio: snapshot.semanaInicio.toISOString(),
            filas: snapshot.filas.map((fila) => ({
                categoria: fila.categoria,
                total: fila.total,
                correcciones: fila.correcciones,
                tasaCorreccion: fila.tasaCorreccion,
                accuracyBanco: fila.accuracyBanco,
                brechaPp: fila.brechaPp,
                alertada: fila.alertada,
                // No se persiste: se deriva del umbral vigente al momento de leer.
                muestraInsuficiente: fila.total < params.minMuestra,
            })),
            baseline: {
                baselineFecha: baseline?.fechaFin.toISOString() ?? null,
                baselineRunId: baseline?.runId ?? null,
                baselineVieja,
            },
            umbrales: { umbralPp: params.umbralPp, minMuestra: params.minMuestra },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[MotorDeriva] GET deriva: error", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
