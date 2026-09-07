import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ColegioResumenRepository } from "@/lib/dal/repositories/colegio-resumen";
import { HomeRectorPage } from "@/components/modules/colegio/home/HomeRectorPage";
import { EmptyStateColegio } from "@/components/modules/colegio/home/EmptyStateColegio";
// SPEC-344 (A-69 · C1 · Phase 12 / FR-041): OnboardingModal APAGADO en favor
// del camino guiado del colegio (`/camino/colegio/**` + guardián en
// `middleware.ts`). El modal persistía "pasoActual" en BD como 2ª fuente de
// verdad — exactamente el patrón que `estado-colegio.ts:2-17` mata. El
// componente NO se borra (regla nada-se-borra); solo deja de montarse.
// Reversible: revertir este commit y descomentar el import + el render.
// import { OnboardingModal } from "@/components/modules/colegio/OnboardingModal";
import { calcularCobertura } from "@/lib/colegio/cobertura";

/**
 * SPEC-143 (FR-001/FR-002) — Home operativa del rector.
 * REEMPLAZA la home anterior (ficha + consulta pública + estadísticas PÚBLICAS de
 * plataforma): la decisión C2/C3 de SPEC-129 queda SUPERADA (documentado en el
 * cierre de SPEC-143). ConsultaPublica/PublicDashboard siguen en la landing `/`.
 *
 * La vigencia y el cambio de contraseña los hace el `middleware.ts`/`layout.tsx`;
 * la vigencia y el consentimiento, el middleware. La AUTORIZACIÓN de esta página
 * la hace ELLA MISMA (SPEC-571): `verifyToken` + `findSesionColegio` — sin
 * `colegioId` de sesión, redirige a /login; el layout NO guarda por rol. Aquí se
 * lee la identidad para el saludo y el `colegioId`. TODOS los datos propios salen
 * de UNA llamada a `ColegioResumenRepository.homeRector(colegioId)`.
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
    const cobertura = await calcularCobertura(usuario.colegioId);

    // US4: colegio sin cursos → empty state del mockup §5.2 (no un tablero de ceros).
    if (datos.kpis.cursos === 0) {
        return <EmptyStateColegio colegioNombre={datos.colegio.nombre} />;
    }

    return (
        <HomeRectorPage
            nombreUsuario={usuario.nombre?.trim() ?? ""}
            datos={datos}
            cobertura={cobertura}
        />
    );
}
