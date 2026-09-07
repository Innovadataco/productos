import { redirect } from "next/navigation";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { homeAccesoDenegado } from "./acceso-denegado";


export default async function OperadoresIndexPage() {
    const acceso = await verificarAccesoPagina("operadores");
    if (!acceso.permitido || acceso.rol !== "ADMIN") redirect(homeAccesoDenegado(acceso.rol));
    redirect("/dashboard/admin/operadores/asignar");
}
