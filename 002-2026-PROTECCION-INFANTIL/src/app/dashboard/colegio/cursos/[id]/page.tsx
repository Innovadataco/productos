import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import CursoDetallePageClient from "./CursoDetallePageClient";

export default async function CursoDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;
    return <CursoDetallePageClient params={params} />;
}
