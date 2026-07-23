import { AdminAntiAbusoSimulacion } from "@/components/modules/AdminAntiAbusoSimulacion";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

export default async function AdminAntiAbusoPage() {
    const acceso = await verificarAccesoPagina("anti_abuso");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <AdminAntiAbusoSimulacion />;
}
