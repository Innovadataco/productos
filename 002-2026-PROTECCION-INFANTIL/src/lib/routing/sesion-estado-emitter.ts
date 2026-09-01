import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { requiereConsentimientoActual } from "@/lib/consentimiento/guard";
import { resolverEstadoVigencia } from "@/lib/pagos/vigencia-middleware";
import type { EstadoVigenciaEfectivo } from "@/lib/pagos/vigencia-middleware";
import { firmarSesionEstado } from "@/lib/routing/vigencia-cookie";
import { requireEnv } from "@/lib/env";
import { verificarVigenciaCliente } from "@/lib/colegio/vigencia";
import { EstadoSuscripcion } from "@prisma/client";
import { derivarPasoPendiente } from "@/lib/dal/services/camino/estado";
import { derivarPasoPendienteColegio } from "@/lib/dal/services/camino/estado-colegio";
import type { PasoPendiente } from "@/lib/camino/pasos";
import type { PasoPendienteColegio } from "@/lib/camino/pasos-colegio";

/**
 * Construye el valor firmado de la cookie `sesion_estado` para un usuario.
 * Resuelve la vigencia según el rol (SPEC-331):
 *   - SCHOOL_ADMIN / COMITE_CONVIVENCIA → ventana del colegio (verificarVigenciaCliente).
 *   - PARENT → suscripción propia (SPEC-242).
 *   - Roles internos (ADMIN, OPERADOR, COMITE_VALIDACION) → siempre ACTIVA.
 * Corre en Node runtime — NO importar desde middleware.ts (Edge).
 */
export async function buildSesionEstadoValue(userId: string): Promise<string> {
    const repo = new UsuarioRepository();
    const [suscripcion, requiereConsentimiento, flag, usuarioVigencia] = await Promise.all([
        new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(userId),
        requiereConsentimientoActual(userId),
        repo.findDebeCambiarPassword(userId),
        repo.findVigenciaCliente(userId),
    ]);

    const rol = usuarioVigencia?.rol;
    let vigencia: EstadoVigenciaEfectivo;

    if (rol === "SCHOOL_ADMIN" || rol === "COMITE_CONVIVENCIA") {
        const resultado = await verificarVigenciaCliente(userId);
        vigencia = resultado.vigente ? EstadoSuscripcion.ACTIVA : EstadoSuscripcion.SUSPENDIDA;
    } else if (rol === "ADMIN" || rol === "OPERADOR" || rol === "COMITE_VALIDACION") {
        vigencia = EstadoSuscripcion.ACTIVA;
    } else {
        vigencia = resolverEstadoVigencia(suscripcion);
    }

    const debeCambiarPassword = Boolean(flag?.debeCambiarPassword);

    // SPEC-339 (A-67) + SPEC-344 (A-69 · C1): el camino guiado del padre y del
    // colegio comparten la MISMA cookie firmada, discriminando por rol. El paso
    // se DERIVA (no se persiste — regla estado.ts y estado-colegio.ts).
    // ADMIN / OPERADOR / COMITE_VALIDACION / COMITE_CONVIVENCIA siguen con `null`.
    const pasoCamino: PasoPendiente | PasoPendienteColegio =
        rol === "PARENT"
            ? await derivarPasoPendiente(userId)
            : rol === "SCHOOL_ADMIN"
            ? await derivarPasoPendienteColegio(userId)
            : null;

    return firmarSesionEstado(
        { vigencia, requiereConsentimiento, debeCambiarPassword, pasoCamino },
        requireEnv("JWT_SECRET", 32),
    );
}
