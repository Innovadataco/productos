import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import AlumnoDetallePageClient from "./AlumnoDetallePageClient";

export default async function AlumnoDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;
    return <AlumnoDetallePageClient params={params} />;
}
