/**
 * SPEC-344 (A-69 · C1) → SPEC-962 — El camino del colegio ya NO tiene pantalla de
 * cierre: era un clic de más. El rector cae DIRECTO en /dashboard/colegio al
 * terminar, por la server action «Terminar» del Paso 5 (estudiantes/actions.ts).
 *
 * Esta ruta queda como redirect server-side para quien la visite directo (enlaces
 * viejos, back, refresh), conservando la guardia de rol y de paso pendiente:
 *   - rol != SCHOOL_ADMIN → su propia home;
 *   - paso pendiente → ese paso (el camino se sostiene, no se gana);
 *   - camino completo → el panel.
 * NO envía correo: el aviso de bienvenida nace del CIERRE explícito (server action),
 * nunca de un GET (prefetch).
 */
import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { homeParaRol } from "@/lib/auth/home-para-rol";
import { derivarPasoPendienteColegio } from "@/lib/dal/services/camino/estado-colegio";
import { destinoDePasoColegio } from "@/lib/camino/pasos-colegio";

// La página depende de la sesión: nunca se pre-renderiza estática.
export const dynamic = "force-dynamic";

export default async function CaminoColegioListoPage() {
    const usuario = await verifyAuth();
    // SPEC-564: cada rol vuelve a SU área, no al panel del reportero (que le daría 403).
    if (usuario.rol !== "SCHOOL_ADMIN") redirect(homeParaRol(usuario.rol));
    const paso = await derivarPasoPendienteColegio(usuario.id);
    if (paso) redirect(destinoDePasoColegio(paso));
    redirect("/dashboard/colegio");
}
