import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import ColegioEstadisticasPageClient from "./ColegioEstadisticasPageClient";

export default async function ColegioEstadisticasPage() {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;
    return <ColegioEstadisticasPageClient />;
}
