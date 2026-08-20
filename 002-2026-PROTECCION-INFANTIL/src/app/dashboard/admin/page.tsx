import { redirect } from "next/navigation";
import { AdminReportesTable } from "@/components/modules/AdminReportesTable";
import { SinAccesoModulo, SinModulosAsignados } from "@/components/modules/SinAccesoModulo";
import { modulosPermitidosParaRol, verificarAccesoPagina } from "@/lib/permisos-modulos";
import { ADMIN_NAV_ITEMS } from "@/lib/nav-items";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";

export default async function AdminBandejaPage() {
    const acceso = await verificarAccesoPagina("bandeja_reportes");

    if (!acceso.permitido && acceso.rol) {
        // Aterrizaje (spec 086, vacío 4): sin bandeja, ir al primer módulo permitido.
        // D-41 (SPEC-126): el destino también debe pasar el predicado del proxy —
        // redirigir a una ruta que la puerta bloquea sería un aterrizaje muerto.
        const permitidos = await modulosPermitidosParaRol(acceso.rol);
        const primero = ADMIN_NAV_ITEMS.find(
            (item) => permitidos.has(item.modulo) && esDestinoPermitidoPorRol(acceso.rol, item.href)
        );
        if (primero) redirect(primero.href);
        return <SinModulosAsignados />;
    }

    if (!acceso.permitido) {
        return <SinAccesoModulo />;
    }

    return <AdminReportesTable rol={acceso.rol} />;
}
