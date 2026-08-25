/**
 * SPEC-244 (002-PI-147): POST /api/padre/suscripcion/activar-freemium
 *
 * Un padre autenticado activa su prueba gratis desde la UI de suscripción.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { pagosActivarFreemiumBodySchema } from "@/lib/schemas/pagos";
import { activarFreemiumConRateLimit } from "@/lib/pagos/freemium-activacion.service";

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const rate = await checkRateLimit(request, "pagos_write", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = pagosActivarFreemiumBodySchema.parse(body);

        const resultado = await activarFreemiumConRateLimit({
            usuario: {
                id: usuario.id,
                rol: usuario.rol,
                colegioId: usuario.colegioId,
                email: usuario.email,
                nombre: usuario.nombre,
            },
            aceptaTerminos: parsed.aceptaTerminos,
            request,
        });

        return NextResponse.json(
            {
                suscripcionId: resultado.suscripcion.id,
                estado: resultado.suscripcion.estado,
                esFreemium: resultado.suscripcion.esFreemium,
                freemiumFechaFin: resultado.freemiumFechaFin.toISOString(),
            },
            { status: 201 }
        );
    } catch (error) {
        return errorToResponse(error, "[PADRE/SUSCRIPCION/ACTIVAR-FREEMIUM]");
    }
}
