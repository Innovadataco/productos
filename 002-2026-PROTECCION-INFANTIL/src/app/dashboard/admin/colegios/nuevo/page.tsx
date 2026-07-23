import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import NuevoColegioPageClient from "./NuevoColegioPageClient";

export default async function NuevoColegioPage() {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <NuevoColegioPageClient />;
}
