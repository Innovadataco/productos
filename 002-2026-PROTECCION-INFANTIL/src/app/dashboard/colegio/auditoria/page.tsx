import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import ColegioAuditoriaPageClient from "./ColegioAuditoriaPageClient";

export default async function ColegioAuditoriaPage() {
    const acceso = await verificarAccesoPagina("colegios_auditoria");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;
    return <ColegioAuditoriaPageClient />;
}
