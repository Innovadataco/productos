import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verifyToken } from "@/lib/auth";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ColegioResumenRepository } from "@/lib/dal/repositories/colegio-resumen";
import TableroClient from "./TableroClient";

/**
 * SPEC-158 (FR-001/FR-002) — Tablero de control del colegio (§10 fila 6).
 * Página NUEVA: la página vieja `/dashboard/colegio/estadisticas` NO se toca
 * (Assumption de la spec). La auth la hace el layout; aquí se verifica el módulo
 * y se lee la sesión para el `colegioId`. TODOS los datos salen de UNA llamada
 * a `ColegioResumenRepository.tableroColegio(colegioId)` — Promise.all de
 * agregados, cero N+1, tenant en cada query.
 */
export default async function TableroColegioPage() {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;

    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const payload = await verifyToken(token);
    if (!payload?.sub) redirect("/login");

    const usuario = await new UsuarioRepository().findSesionColegio(payload.sub as string);
    if (!usuario?.colegioId) redirect("/login");

    const datos = await new ColegioResumenRepository().tableroColegio(usuario.colegioId);

    return <TableroClient datos={datos} />;
}
