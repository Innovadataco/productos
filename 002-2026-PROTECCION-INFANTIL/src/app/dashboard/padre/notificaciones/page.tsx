import { redirect } from "next/navigation";
import { exigirPadre } from "@/lib/padre/guardia-padre";

/**
 * SPEC-607: las preferencias de notificaciones del padre viven dentro de
 * «Mi perfil» (acordeón «Notificaciones»). Redirect de servidor con ancla
 * para no romper enlaces existentes. La página real multi-rol sigue en
 * `/dashboard/perfil/notificaciones` (la usan los demás roles).
 */
export default async function PadreNotificacionesRedirectPage() {
    await exigirPadre(); // SPEC-711: compuerta por rol (rol ≠ PARENT → su área)
    redirect("/dashboard/padre/perfil#notificaciones");
}
