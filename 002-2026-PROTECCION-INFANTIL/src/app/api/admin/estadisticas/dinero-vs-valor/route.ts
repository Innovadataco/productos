/**
 * SPEC-218 (002-PI-118): GET /api/admin/estadisticas/dinero-vs-valor.
 * Devuelve KPIs + 4 widgets del dashboard dinero-vs-valor (contrato en
 * specs/218-analitica-dinero-vs-valor-pagos/contracts/218-analitica.md).
 * Solo rol ADMIN con módulo pagos_admin; la lógica vive en AnaliticaPagosService
 * y las queries en PagosRepository (frontera DAL Q-3). Sin IA (FR-010).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PagosAnaliticaRepository } from "@/lib/dal/repositories/pagos-analitica-repository";
import { AnaliticaPagosService } from "@/lib/pagos/analitica.service";
import { obtenerCacheAnaliticaSegundos } from "@/lib/pagos/parametros-pagos";

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "pagos_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const cacheSegundos = await obtenerCacheAnaliticaSegundos();
        const analitica = await new AnaliticaPagosService(new PagosAnaliticaRepository(), { cacheSegundos }).obtenerAnalitica();
        return NextResponse.json(analitica);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ESTADISTICAS/DINERO-VS-VALOR]");
    }
}
