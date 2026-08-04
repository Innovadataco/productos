import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ColegioResumenRepository } from "@/lib/dal/repositories/colegio-resumen";
import { HomeRectorPage } from "@/components/modules/colegio/home/HomeRectorPage";
import { EmptyStateColegio } from "@/components/modules/colegio/home/EmptyStateColegio";

/**
 * SPEC-143 (FR-001/FR-002) — Home operativa del rector.
 * REEMPLAZA la home anterior (ficha + consulta pública + estadísticas PÚBLICAS de
 * plataforma): la decisión C2/C3 de SPEC-129 queda SUPERADA (documentado en el
 * cierre de SPEC-143). ConsultaPublica/PublicDashboard siguen en la landing `/`.
 *
 * La auth (rol, vigencia, cambio de contraseña) la hace el `layout.tsx`: aquí solo
 * se lee la identidad de sesión para el saludo y el `colegioId`. TODOS los datos
 * propios salen de UNA llamada a `ColegioResumenRepository.homeRector(colegioId)`.
 */
export default async function ColegioDashboardPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) redirect("/login");

    const payload = await verifyToken(token);
    if (!payload?.sub) redirect("/login");

    const usuario = await new UsuarioRepository().findSesionColegio(payload.sub as string);
    if (!usuario?.colegioId) redirect("/login");

    const datos = await new ColegioResumenRepository().homeRector(usuario.colegioId);

    // US4: colegio sin cursos → empty state del mockup §5.2 (no un tablero de ceros).
    if (datos.kpis.cursos === 0) {
        return <EmptyStateColegio colegioNombre={datos.colegio.nombre} />;
    }

    return <HomeRectorPage nombreUsuario={usuario.nombre?.trim() ?? ""} datos={datos} />;
}
