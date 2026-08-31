import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { requiereConsentimientoActual } from "@/lib/consentimiento/guard";
import { resolverEstadoVigencia } from "@/lib/pagos/vigencia-middleware";
import type { EstadoVigenciaEfectivo } from "@/lib/pagos/vigencia-middleware";
import { firmarSesionEstado } from "@/lib/routing/vigencia-cookie";
import { requireEnv } from "@/lib/env";
import { verificarVigenciaCliente } from "@/lib/colegio/vigencia";
import { EstadoSuscripcion } from "@prisma/client";

/**
 * Construye el valor firmado de la cookie `sesion_estado` para un usuario.
 * Resuelve la vigencia según el rol:
 *   - SCHOOL_ADMIN / COMITE_CONVIVENCIA → ventana del colegio (SPEC-119/SPEC-331).
 *   - PARENT → suscripción propia (SPEC-242).
 *   - Roles internos (ADMIN, OPERADOR, COMITE_VALIDACION) → siempre ACTIVA.
 * Corre en Node runtime — NO importar desde middleware.ts (Edge).
 */
export async function buildSesionEstadoValue(userId: string): Promise<string> {
    const [suscripcion, requiereConsentimiento, usuario] = await Promise.all([
        new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(userId),
        requiereConsentimientoActual(userId),
        new UsuarioRepository().findDebeCambiarPassword(userId),
    ]);

    const rol = usuario?.rol;
    let vigencia: EstadoVigenciaEfectivo;

    if (rol === "SCHOOL_ADMIN" || rol === "COMITE_CONVIVENCIA") {
        const resultado = await verificarVigenciaCliente(userId);
        vigencia = resultado.vigente ? EstadoSuscripcion.ACTIVA : EstadoSuscripcion.SUSPENDIDA;
    } else if (rol === "ADMIN" || rol === "OPERADOR" || rol === "COMITE_VALIDACION") {
        vigencia = EstadoSuscripcion.ACTIVA;
    } else {
        vigencia = resolverEstadoVigencia(suscripcion);
    }

    const debeCambiarPassword = Boolean(usuario?.debeCambiarPassword);

    return firmarSesionEstado(
        { vigencia, requiereConsentimiento, debeCambiarPassword },
        requireEnv("JWT_SECRET", 32),
    );
}
