import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { logAudit } from "@/lib/audit";
import { resolverEstadoVigencia } from "@/lib/pagos/vigencia-middleware";

/**
 * Layout de /reportar.
 * SPEC-242 (002-PI-145): la ruta sigue siendo pública, pero si un padre autenticado
 * accede sin suscripción activa se deja traza de auditoría (proteger menores > cobrar).
 * SPEC-603: la sesión se resuelve contra la BD (getSessionUser). Una sesión huérfana
 * (JWT válido de un usuario ya eliminado) se trata como anónima: no hay verificación
 * de suscripción ni auditoría con ese usuarioId — escribir AuditLog con un id
 * inexistente explotaba con P2003 (FK AuditLog_usuarioId_fkey) y tumbaba el render.
 */
export default async function ReportarLayout({ children }: { children: React.ReactNode }) {
    const usuario = await getSessionUser();

    if (!usuario || usuario.rol !== "PARENT") {
        return <>{children}</>;
    }

    const suscripcionActiva = await new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(usuario.id);
    const estadoVigencia = resolverEstadoVigencia(suscripcionActiva);

    if (estadoVigencia !== "ACTIVA" && estadoVigencia !== "EN_GRACIA") {
        const h = await headers();
        await logAudit({
            accion: "REPORTE_SIN_SUSCRIPCION",
            tipoRecurso: "reporte",
            usuarioId: usuario.id,
            ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown",
            userAgent: h.get("user-agent") ?? "unknown",
            metadatos: { estadoSuscripcion: estadoVigencia, ruta: "/reportar" },
        });
    }

    return <>{children}</>;
}
