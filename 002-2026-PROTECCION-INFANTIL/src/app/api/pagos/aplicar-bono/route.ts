/**
 * SPEC-216 (002-PI-116): POST /api/pagos/aplicar-bono
 *
 * Aplica un bono promocional a una suscripción propia del usuario autenticado
 * (SCHOOL_ADMIN para su colegio, PARENT para su usuario).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { withValidation } from "@/lib/validation";
import { pagosAplicarBonoBodySchema } from "@/lib/schemas/pagos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { aplicarBonoPromocional } from "@/lib/pagos/bono-aplicacion.service";
import { getClientInfo } from "@/lib/pagos/api-helpers";
import { auditAccesoDenegado } from "@/lib/audit";
import { RolUsuario } from "@prisma/client";

async function verificarTitularidad(suscripcionId: string, usuario: { id: string; rol: RolUsuario; colegioId: string | null }) {
    const repo = new PagosRepository();
    const suscripcion = await repo.obtenerSuscripcionPorId(suscripcionId);
    if (!suscripcion) return null;

    if (usuario.rol === "SCHOOL_ADMIN") {
        if (!suscripcion.colegio || suscripcion.colegio.id !== usuario.colegioId) {
            return null;
        }
    } else if (usuario.rol === "PARENT") {
        if (!suscripcion.usuario || suscripcion.usuario.id !== usuario.id) {
            return null;
        }
    }

    return suscripcion;
}

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth(["SCHOOL_ADMIN", "PARENT"]);
        const rate = await checkRateLimit(request, "pagos_write", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await withValidation.body(pagosAplicarBonoBodySchema)(request);
        const suscripcion = await verificarTitularidad(body.suscripcionId, usuario);
        if (!suscripcion) {
            await auditAccesoDenegado({
                request,
                usuarioId: usuario.id,
                recurso: "AplicarBono",
                metadatos: { suscripcionId: body.suscripcionId, bonoId: body.bonoId },
            });
            throw new AppError("Suscripción no encontrada o no pertenece al usuario", ERROR_CODES.NOT_FOUND, 404);
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        // SPEC-289 (002-PI-189 · Fase 1): `montoBase` es el nombre canónico
        // neutral de moneda; `montoBaseUSD` queda como alias legacy hasta Fase 2.
        // El schema garantiza que al menos uno viene positivo (refine).
        const montoBase = body.montoBase ?? body.montoBaseUSD ?? 0;
        const resultado = await aplicarBonoPromocional({
            suscripcionId: body.suscripcionId,
            bonoId: body.bonoId,
            montoBaseUSD: montoBase,
            usuarioId: usuario.id,
            ipAddress,
            userAgent,
        });

        return NextResponse.json(resultado, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[PAGOS/APLICAR-BONO]");
    }
}
