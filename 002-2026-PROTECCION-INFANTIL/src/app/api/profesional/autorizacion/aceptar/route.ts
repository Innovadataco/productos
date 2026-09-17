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
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { perfilCompletoParaRevision } from "@/lib/profesional/dto";

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

        // SPEC-703: aceptar es ahora el gate de completitud (reemplaza a la subida de PDF). Si con
        // esta aceptación el BORRADOR quedó completo, pasa a EN_REVISION — simétrico al PUT /perfil
        // y a la vieja subida de PDF. Acabamos de aceptar la versión vigente → aceptó = true.
        const repo = new PerfilProfesionalRepository();
        const perfil = await repo.findPorUsuarioId(user.id);
        if (perfil && perfil.estado === "BORRADOR" && perfilCompletoParaRevision(perfil, true)) {
            await repo.cambiarEstado(perfil.id, "EN_REVISION");
        }

        return NextResponse.json({
            data: { aceptadoEn: aceptacion.aceptadoEn.toISOString(), version },
        });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/AUTORIZACION/ACEPTAR]");
    }
}
