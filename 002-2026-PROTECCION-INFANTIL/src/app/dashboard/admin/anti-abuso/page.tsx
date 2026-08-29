import { AdminAntiAbusoTabs } from "@/components/modules/AdminAntiAbusoTabs";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

export default async function AdminAntiAbusoPage() {
    const acceso = await verificarAccesoPagina("anti_abuso");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <AdminAntiAbusoTabs />;
}
