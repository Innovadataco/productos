import { redirect } from "next/navigation";

/**
 * SPEC-607: las preferencias de notificaciones del padre viven dentro de
 * «Mi perfil» (acordeón «Notificaciones»). Redirect de servidor con ancla
 * para no romper enlaces existentes. La página real multi-rol sigue en
 * `/dashboard/perfil/notificaciones` (la usan los demás roles).
 */
export default function PadreNotificacionesRedirectPage() {
    // SPEC-711: stub de redirect PURO — no rinde cascarón, así que no lleva compuerta
    // de rol (mismo criterio que SPEC-571 · mecanismo 4). El destino (Mi perfil) sí gatea.
    redirect("/dashboard/padre/perfil#notificaciones");
}
