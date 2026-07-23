import { redirect } from "next/navigation";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

export default async function EstadisticasIndexPage() {
    const acceso = await verificarAccesoPagina("estadisticas");
    if (!acceso.permitido) return <SinAccesoModulo />;
    redirect("/dashboard/admin/estadisticas/operacion");
}
