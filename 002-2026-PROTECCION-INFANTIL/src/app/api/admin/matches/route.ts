import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { EventoMatchRepository } from "@/lib/dal/repositories/evento-match";

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * GET /api/admin/matches (SPEC-139, F5; ZEUS D-4)
 * Listado admin de eventos de match con detalle agregado (identificador,
 * conteo, ciudades, conductas coincidentes, interCiudad, fecha) + tendencia
 * temporal. FR-009: NUNCA usuarioId, huellas de fuente ni textos — el select
 * del repo solo trae metadatos agregados. El público solo ve el CONTEO
 * (estadísticas públicas), nunca este detalle (§1.3).
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

        const url = new URL(request.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { page, pageSize } = parsed.data;

        const repo = new EventoMatchRepository();
        const [eventos, total] = await repo.findPaginadosConDetalle({
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        const tendencia = await repo.tendenciaPorMes();

        return NextResponse.json({
            items: eventos.map((e) => ({
                id: e.id,
                identificador: e.identificador.identificador,
                plataformaId: e.identificador.plataformaId,
                conteoAcumulado: e.conteoAcumulado,
                ciudades: e.ciudades,
                conductasCoincidentes: e.conductasCoincidentes,
                interCiudad: e.interCiudad,
                creadoEn: e.creadoEn,
            })),
            tendencia,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
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
