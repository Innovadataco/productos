import { redirect } from "next/navigation";

/**
 * SPEC-607: las preferencias de notificaciones del padre viven dentro de
 * «Mi perfil» (acordeón «Notificaciones»). Redirect de servidor con ancla
 * para no romper enlaces existentes. La página real multi-rol sigue en
 * `/dashboard/perfil/notificaciones` (la usan los demás roles).
 */
export default function PadreNotificacionesRedirectPage() {
    redirect("/dashboard/padre/perfil#notificaciones");
}
