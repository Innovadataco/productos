import { redirect } from "next/navigation";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

// I-129: roles sin acceso al módulo "operadores" se redirigen a su home en vez de ver la tarjeta de error.
function homeParaRol(rol: string | null): string {
    if (rol === "COMITE_VALIDACION") return "/dashboard/admin/comite";
    return "/dashboard/admin";
}

export default async function OperadoresIndexPage() {
    const acceso = await verificarAccesoPagina("operadores");
    if (!acceso.permitido) redirect(homeParaRol(acceso.rol));
    redirect("/dashboard/admin/operadores/asignar");
}
