import { redirect } from "next/navigation";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

export default async function OperadoresIndexPage() {
    const acceso = await verificarAccesoPagina("operadores");
    if (!acceso.permitido) return <SinAccesoModulo />;
    redirect("/dashboard/admin/operadores/asignar");
}
