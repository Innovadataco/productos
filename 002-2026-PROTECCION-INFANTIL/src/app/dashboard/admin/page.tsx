import { redirect } from "next/navigation";
import { SinModulosAsignados } from "@/components/modules/SinAccesoModulo";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";
import { ADMIN_NAV_ITEMS } from "@/lib/nav-items";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

/**
 * SPEC-404 (I-290): `/dashboard/admin` es SOLO aterrizaje.
 *
 * Preserva marcadores viejos: hasta este SPEC la raíz también renderizaba la
 * Bandeja de reportes, así que hay bookmarks del equipo apuntando acá. Ahora
 * la bandeja tiene URL propia (`/dashboard/admin/bandeja`) y el ítem del menú
 * apunta ahí; esta página redirige a donde el rol tenga aterrizaje real.
 *
 * Orden del redirect:
 *   1. Si tiene `inicio_admin` → Inicio (alarma de la casa, SPEC-378).
 *   2. Si tiene `bandeja_reportes` → Bandeja.
 *   3. Si tiene algún otro módulo → primer ítem del menú al que pueda entrar.
 *   4. Si no tiene módulos asignados → `<SinModulosAsignados />`.
 *
 * D-41 (SPEC-126): el destino elegido tiene que pasar el predicado del proxy
 * (`esDestinoPermitidoPorRol`); si no, sería un aterrizaje muerto.
 */
export default async function AdminAterrizajePage() {
    const accesoInicio = await verificarAccesoPagina("inicio_admin");
    if (accesoInicio.permitido) redirect("/dashboard/admin/inicio");

    const accesoBandeja = await verificarAccesoPagina("bandeja_reportes");
    if (accesoBandeja.permitido) redirect("/dashboard/admin/bandeja");

    const rol = accesoInicio.rol ?? accesoBandeja.rol;
    if (!rol) {
        // Sin sesión no debería llegar acá (middleware corta), pero por si acaso.
        redirect("/login");
    }

    const permitidos = await modulosPermitidosParaRol(rol);
    const primero = ADMIN_NAV_ITEMS.find(
        (item) => permitidos.has(item.modulo) && esDestinoPermitidoPorRol(rol, item.href),
    );
    if (primero) redirect(primero.href);
    return <SinModulosAsignados />;
}
