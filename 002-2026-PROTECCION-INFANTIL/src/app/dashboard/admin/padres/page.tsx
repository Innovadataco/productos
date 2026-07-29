import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import PadresPageClient from "./PadresPageClient";

export default async function AdminPadresPage() {
    const acceso = await verificarAccesoPagina("padres");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <PadresPageClient />;
}
