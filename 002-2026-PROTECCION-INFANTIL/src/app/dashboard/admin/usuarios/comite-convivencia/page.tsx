import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import UsuariosAdminClient from "../UsuariosAdminClient";

export default async function AdminUsuariosComiteConvivenciaPage() {
    const acceso = await verificarAccesoPagina("usuarios_admin");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <UsuariosAdminClient rol="COMITE_CONVIVENCIA" />;
}
