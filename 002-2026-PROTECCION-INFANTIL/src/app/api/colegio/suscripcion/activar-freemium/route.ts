/**
 * SPEC-344 (A-69 · C1) — POST /api/colegio/suscripcion/activar-freemium.
 *
 * Espejo colegio del endpoint del padre. Cierra el Paso 2 del camino
 * (activación freemium 30 días parametrizables) Y dispara el PUENTE D2:
 * escribe `Colegio.finServicio = hoy + pagos.freemium.duracion_dias`, para
 * que un colegio nuevo deje de quedar "gratis para siempre" al pasar por el
 * camino.
 *
 * Exento del guardián del camino (guardias.ts:camino.exentasSchoolAdmin).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { pagosActivarFreemiumBodySchema } from "@/lib/schemas/pagos";
import { activarFreemiumColegio } from "@/lib/pagos/freemium-activacion.service";
import { actualizarFinServicioDesdePlan } from "@/lib/pagos/vigencia-colegio.service";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("SCHOOL_ADMIN");
        const rate = await checkRateLimit(request, "pagos_write", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers },
            );
        }

        if (!usuario.colegioId) {
            return NextResponse.json(
                { error: { message: "Este rector no tiene colegio asociado.", code: ERROR_CODES.CONFLICT } },
                { status: 409 },
            );
        }

        const body = await request.json();
        const parsed = pagosActivarFreemiumBodySchema.parse(body);

        const resultado = await activarFreemiumColegio({
            usuarioId: usuario.id,
            colegioId: usuario.colegioId,
            email: usuario.email,
            nombre: usuario.nombre,
            aceptaTerminos: parsed.aceptaTerminos,
            ipAddress: getClientIp(request),
            userAgent: request.headers.get("user-agent") ?? undefined,
        });

        // Puente D2 (R6, matiz CEO 03:18): cerrar el paso Plan del camino
        // NO puede dejar al colegio "gratis para siempre". Escribimos
        // `Colegio.finServicio` con la ventana freemium.
        const finServicio = await actualizarFinServicioDesdePlan(usuario.colegioId, { tipo: "freemium" });

        const res = NextResponse.json(
            {
                suscripcionId: resultado.suscripcion.id,
                estado: resultado.suscripcion.estado,
                esFreemium: resultado.suscripcion.esFreemium,
                freemiumFechaFin: resultado.freemiumFechaFin.toISOString(),
                colegioFinServicio: finServicio.toISOString(),
            },
            { status: 201 },
        );
        // Sella la cookie para que el Paso 2 del camino cierre AL INSTANTE.
        await sellarCookieSesionEstado(res, usuario.id);
        return res;
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/SUSCRIPCION/ACTIVAR-FREEMIUM]");
    }
}
