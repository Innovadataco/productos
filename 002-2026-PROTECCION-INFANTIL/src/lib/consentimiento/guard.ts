/**
 * SPEC-241 (002-PI-144): guardia reusable de consentimiento informado.
 * Server-only: verifica si un usuario autenticado debe aceptar/re-aceptar
 * la versión vigente del consentimiento antes de acceder a rutas protegidas.
 */
import { ConsentimientoService } from "@/lib/dal/services/consentimiento";

/**
 * Retorna `true` si el usuario debe ser redirigido a /consentimiento.
 * Retorna `false` si ya aceptó la versión vigente o si no hay versión configurada
 * (fail-open para no bloquear a todos ante un problema de configuración).
 */
export async function requiereConsentimientoActual(usuarioId: string): Promise<boolean> {
    try {
        const servicio = new ConsentimientoService();
        return !(await servicio.versionEstaActual(usuarioId));
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        console.error("[ConsentimientoGuard] Error verificando consentimiento:", msg);
        console.error(JSON.stringify({ usuarioId: usuarioId ?? null, evento: "consentimiento.guard.fail", detalle: msg, timestamp: new Date().toISOString() }));
        // Fail-open: si no podemos verificar, no bloqueamos al usuario.
        return false;
    }
}
