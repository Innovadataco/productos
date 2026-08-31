import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { requiereConsentimientoActual } from "@/lib/consentimiento/guard";
import { resolverEstadoVigencia } from "@/lib/pagos/vigencia-middleware";
import { firmarSesionEstado } from "@/lib/routing/vigencia-cookie";
import { requireEnv } from "@/lib/env";

/**
 * Construye el valor firmado de la cookie `sesion_estado` para un usuario.
 * Extrae la lógica de /api/vigencia/refresh/route.ts para reutilizarla
 * en las rutas de auth y session/ping.
 * Corre en Node runtime — NO importar desde middleware.ts (Edge).
 */
export async function buildSesionEstadoValue(userId: string): Promise<string> {
    const [suscripcion, requiereConsentimiento, usuario] = await Promise.all([
        new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(userId),
        requiereConsentimientoActual(userId),
        new UsuarioRepository().findDebeCambiarPassword(userId),
    ]);

    const vigencia = resolverEstadoVigencia(suscripcion);
    const debeCambiarPassword = Boolean(usuario?.debeCambiarPassword);

    return firmarSesionEstado(
        { vigencia, requiereConsentimiento, debeCambiarPassword },
        requireEnv("JWT_SECRET", 32),
    );
}
