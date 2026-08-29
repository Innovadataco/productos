/**
 * SPEC-148 (US2, FR-003): GET /api/colegio/buscar?q= — buscador global del
 * colegio (⌘K). Tenant-first (colegioId de sesión en cada query del repo),
 * solo activos, mínimo 2 caracteres, resultados agrupados top 5 por grupo con
 * conteo de restantes. Rate limit admin_read (mismo patrón que las demás
 * rutas del colegio — SPEC-145).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { BusquedaColegioRepository } from "@/lib/dal/repositories/busqueda-colegio";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const q = new URL(request.url).searchParams.get("q") ?? "";
        // SPEC-148 (E-1): la consulta vive en el repo (SIEMPRE con tenant). La
        // consulta de menos de 2 caracteres la resuelve el repo sin tocar la BD.
        const resultado = await new BusquedaColegioRepository().buscar(user.colegioId, q);

        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/BUSCAR]");
    }
}
