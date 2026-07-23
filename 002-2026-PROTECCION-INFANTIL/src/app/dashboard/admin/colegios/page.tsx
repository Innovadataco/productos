import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import ColegiosPageClient from "./ColegiosPageClient";

export default async function AdminColegiosPage() {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <ColegiosPageClient />;
}
