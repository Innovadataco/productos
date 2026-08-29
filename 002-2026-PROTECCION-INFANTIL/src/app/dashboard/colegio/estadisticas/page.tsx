import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { calcularInteligenciaColegio } from "@/lib/colegio/inteligencia";
import ColegioEstadisticasPageClient from "./ColegioEstadisticasPageClient";

/**
 * SPEC-167 (FR-004) — Estadísticas como inteligencia del colegio.
 * El server fetch trae el DTO ampliado (una sola llamada orquestada) y lo pasa
 * al cliente; la comparativa puede repintarse desde el cliente sin recargar
 * la página entera.
 */
export default async function ColegioEstadisticasPage() {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;

    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const payload = await verifyToken(token);
    if (!payload?.sub) redirect("/login");

    const usuario = await new UsuarioRepository().findSesionColegio(payload.sub as string);
    if (!usuario?.colegioId) redirect("/login");

    const datos = await calcularInteligenciaColegio(usuario.colegioId);

    return <ColegioEstadisticasPageClient datos={datos} />;
}
