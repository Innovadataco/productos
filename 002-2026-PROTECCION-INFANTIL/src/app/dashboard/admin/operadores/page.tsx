import { redirect } from "next/navigation";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

// I-129: roles sin acceso al módulo "operadores" se redirigen a su home en vez de ver la tarjeta de error.
// SPEC-319: esto NO es la fuente única rol→home (esa vive en src/lib/auth/home-para-rol.ts). Es un
// fallback local de acceso-denegado a ESTE módulo: solo distingue COMITE_VALIDACION del default admin
// porque son los únicos roles admin que llegan hasta acá. No unificar con la fuente única — su
// semántica es "a dónde mando a quien no tiene acceso a operadores", no "el landing del rol".
function homeAccesoDenegado(rol: string | null): string {
    if (rol === "COMITE_VALIDACION") return "/dashboard/admin/comite";
    return "/dashboard/admin";
}

export default async function OperadoresIndexPage() {
    const acceso = await verificarAccesoPagina("operadores");
    if (!acceso.permitido) redirect(homeAccesoDenegado(acceso.rol));
    redirect("/dashboard/admin/operadores/asignar");
}
