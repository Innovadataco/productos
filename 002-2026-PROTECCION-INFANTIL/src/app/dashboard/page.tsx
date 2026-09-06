import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { homeParaRol } from "@/lib/auth/home-para-rol";
import { DashboardUsuarioClient } from "@/components/modules/DashboardUsuarioClient";

// Depende de la sesión: nunca se pre-renderiza estática.
export const dynamic = "force-dynamic";

/**
 * SPEC-564 (I-346): `/dashboard` (pelado) es el panel del REPORTERO — su widget
 * pide `/api/reportes/mis-reportes`, que exige `verifyAuth("PARENT")`. Un OPERADOR
 * o COMITE_VALIDACION que entra directo acá (URL, marcador viejo, o un redirect
 * ajeno) recibía «No pudimos cargar tus reportes» (403) como PRIMERA pantalla, que
 * es justo lo que enseña a ignorar errores a quien revisa denuncias.
 *
 * El modelo de rol (`esDestinoPermitidoPorRol`) NO se aplica en el middleware en
 * runtime —solo lo consumen navs y arch:check—, así que la guardia va acá: cada rol
 * vuelve a SU área, nunca a un error (lección I-299). El PARENT sí ve su panel.
 */
export default async function DashboardPage() {
    const user = await verifyAuth();
    if (user.rol !== "PARENT") redirect(homeParaRol(user.rol));
    return <DashboardUsuarioClient />;
}
