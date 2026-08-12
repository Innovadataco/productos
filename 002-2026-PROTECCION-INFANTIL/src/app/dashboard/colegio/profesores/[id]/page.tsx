import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import ProfesorDetallePageClient from "./ProfesorDetallePageClient";

export default async function ProfesorDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio/profesores" />;
    return <ProfesorDetallePageClient params={params} />;
}
