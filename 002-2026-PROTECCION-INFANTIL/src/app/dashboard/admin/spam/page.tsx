import { SpamRevisionPanel } from "@/components/modules/SpamRevisionPanel";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

export default async function SpamRevisionPage() {
    const acceso = await verificarAccesoPagina("revision_spam");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <SpamRevisionPanel />;
}
