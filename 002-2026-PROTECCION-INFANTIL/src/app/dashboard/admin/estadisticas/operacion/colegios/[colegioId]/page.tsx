import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import ColegioDetalleClient from "./ColegioDetalleClient";

export default async function AdminColegioDetallePage() {
    const acceso = await verificarAccesoPagina("analytics_colegios");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <ColegioDetalleClient />;
}
