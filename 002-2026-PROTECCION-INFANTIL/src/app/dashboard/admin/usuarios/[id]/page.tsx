import { notFound } from "next/navigation";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { UsuariosConsolidadoService } from "@/lib/dal/services/usuarios-consolidado";
import UsuarioDetalleClient from "./UsuarioDetalleClient";

interface AdminUsuarioDetallePageProps {
    params: Promise<{ id: string }>;
}

export default async function AdminUsuarioDetallePage({ params }: AdminUsuarioDetallePageProps) {
    const acceso = await verificarAccesoPagina("usuarios_admin");
    if (!acceso.permitido) return <SinAccesoModulo />;

    const { id } = await params;
    const detalle = await new UsuariosConsolidadoService().detallePorId(id);
    if (!detalle) notFound();

    return <UsuarioDetalleClient detalle={detalle} />;
}
