import { AdminApelaciones } from "@/components/modules/AdminApelaciones";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminApelacionesPage() {
    const acceso = await verificarAccesoPagina("apelaciones");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <AdminApelaciones />;
}
