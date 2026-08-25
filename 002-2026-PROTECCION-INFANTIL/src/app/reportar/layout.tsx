import { cookies, headers } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { logAudit } from "@/lib/audit";
import { resolverEstadoVigencia } from "@/lib/pagos/vigencia-middleware";

/**
 * Layout de /reportar.
 * SPEC-242 (002-PI-145): la ruta sigue siendo pública, pero si un padre autenticado
 * accede sin suscripción activa se deja traza de auditoría (proteger menores > cobrar).
 */
export default async function ReportarLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        return <>{children}</>;
    }

    const payload = await verifyToken(token);
    const usuarioId = payload?.sub as string | undefined;
    const rol = payload?.rol as string | undefined;

    if (!usuarioId || rol !== "PARENT") {
        return <>{children}</>;
    }

    const suscripcionActiva = await new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(usuarioId);
    const estadoVigencia = resolverEstadoVigencia(suscripcionActiva);

    if (estadoVigencia !== "ACTIVA" && estadoVigencia !== "EN_GRACIA") {
        const h = await headers();
        await logAudit({
            accion: "REPORTE_SIN_SUSCRIPCION",
            tipoRecurso: "reporte",
            usuarioId,
            ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown",
            userAgent: h.get("user-agent") ?? "unknown",
            metadatos: { estadoSuscripcion: estadoVigencia, ruta: "/reportar" },
        });
    }

    return <>{children}</>;
}
