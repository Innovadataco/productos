/**
 * SPEC-686 (I-420) · POST /api/profesional/autorizacion/aceptar
 *
 * El profesional ACEPTA EN PANTALLA la autorización (Ley 1918/2018 · Decreto 753/2019 ·
 * Ley 2375/2024). Se registra versión + hash SHA-256 del texto + fecha + IP + user-agent en
 * `aceptaciones_autorizacion_profesional` (NO en `audit_consentimientos`). Capa fina.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { AutorizacionProfesionalService } from "@/lib/dal/services/autorizacion-profesional";

function obtenerIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
    return "unknown";
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "profesional_ficha");
        const { aceptacion, version } = await new AutorizacionProfesionalService().aceptar({
            usuarioId: user.id,
            ip: obtenerIp(request),
            userAgent: request.headers.get("user-agent"),
        });

        // SPEC-706: aceptar SOLO registra la aceptación. Ya NO transiciona a EN_REVISION — enviar a
        // revisión es un acto explícito del profesional (botón «Guardar y enviar a revisión» en la
        // ficha), nunca un efecto colateral de aceptar. El profesional vuelve a la ficha y decide.
        return NextResponse.json({
            data: { aceptadoEn: aceptacion.aceptadoEn.toISOString(), version },
        });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/AUTORIZACION/ACEPTAR]");
    }
}
