import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import UsuarioDetalleClient from "./UsuarioDetalleClient";

export default async function AdminUsuarioDetallePage() {
    const acceso = await verificarAccesoPagina("usuarios_admin");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return <UsuarioDetalleClient />;
}
