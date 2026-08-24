import { NextResponse } from "next/server";
import { RolUsuario } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { AnalisisRecomendacionesService } from "@/lib/dal/services/analisis-recomendaciones";
import {
    parsearFiltrosDesdeSearchParams,
    resolverFiltros,
} from "@/lib/analisis/filtros-historial";
import {
    construirFilasExport,
    nombreArchivoExport,
    toCsv,
} from "@/lib/analisis/historial-csv";

/**
 * SPEC-227 (002-PI-128, FR-006/007/008): export CSV del historial filtrado,
 * SIN PII (Ley 1581): columnas fijas de metadatos, nunca título/descripción/
 * datosContexto; el sujeto viaja como hash opaco SHA-256 con sal de entorno
 * (`ANALISIS_EXPORT_SALT`, fail-closed si falta). Tope
 * `analisis.recomendaciones.export_max_filas` (413 si se excede) y AuditLog
 * por exportación (filtros + conteo, sin contenido).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "analisis_recomendaciones");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const filtrosQuery = parsearFiltrosDesdeSearchParams(searchParams);

        // Fail-closed: sin sal de servidor no se exporta (nunca el id crudo).
        const sal = process.env.ANALISIS_EXPORT_SALT;
        if (!sal) {
            throw new AppError(
                "Exportación no disponible: falta configuración del servidor",
                ERROR_CODES.INTERNAL_ERROR,
                500
            );
        }

        const servicio = new AnalisisRecomendacionesService();
        const { filas } = await servicio.prepararExport(resolverFiltros(filtrosQuery));
        const csv = toCsv(construirFilasExport(filas, sal));

        await servicio.registrarAuditoriaExport({
            usuarioId: user.id,
            filtros: filtrosQuery,
            filasExportadas: filas.length,
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
            userAgent: request.headers.get("user-agent") || "unknown",
        });

        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${nombreArchivoExport()}"`,
            },
        });
    } catch (error) {
        return errorToResponse(error, "[ANALISIS/RECOMENDACIONES/EXPORT]");
    }
}
