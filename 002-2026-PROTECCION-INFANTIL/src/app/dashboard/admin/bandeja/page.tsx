/**
 * SPEC-404 (I-290): Bandeja de reportes con URL propia y estable.
 *
 * Antes de este SPEC vivía en `/dashboard/admin` (raíz), lo que la volvía
 * inalcanzable para cualquier admin con el módulo `inicio_admin` — SPEC-378
 * agregó allí un `redirect("/dashboard/admin/inicio")` sin excepción y el
 * ítem del menú "Bandeja de reportes" apuntaba a la misma URL. Al hacer
 * click el admin caía en Inicio y no había forma de abrir la bandeja.
 *
 * La bandeja ahora tiene URL propia. La raíz `/dashboard/admin` queda como
 * aterrizaje que respeta marcadores viejos: manda a Inicio si el módulo
 * está, a la bandeja si no.
 */
import { AdminReportesTable } from "@/components/modules/AdminReportesTable";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

export default async function AdminBandejaPage() {
    const acceso = await verificarAccesoPagina("bandeja_reportes");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <AdminReportesTable rol={acceso.rol} />;
}
