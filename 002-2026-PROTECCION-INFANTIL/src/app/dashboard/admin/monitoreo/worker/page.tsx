import { redirect } from "next/navigation";
import { MonitoreoWorkerClient } from "@/components/modules/MonitoreoWorkerClient";
import { SinAccesoModulo, SinModulosAsignados } from "@/components/modules/SinAccesoModulo";
import { modulosPermitidosParaRol, verificarAccesoPagina } from "@/lib/permisos-modulos";
import { ADMIN_NAV_ITEMS } from "@/lib/nav-items";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";

export default async function MonitoreoWorkerPage() {
    const acceso = await verificarAccesoPagina("monitoreo_worker");

    if (!acceso.permitido && acceso.rol) {
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

    return (
        <div className="container mx-auto px-4 py-6">
            <h1 className="mb-6 text-2xl font-semibold text-body">Monitoreo del worker</h1>
            <MonitoreoWorkerClient />
        </div>
    );
}
