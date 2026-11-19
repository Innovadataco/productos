import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import AlumnoDetallePageClient from "./AlumnoDetallePageClient";

export default async function AlumnoDetallePage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;
    // SPEC-931: el origen decide a dónde vuelve «← Volver» (listado de estudiantes o curso).
    const { desde } = await searchParams;
    return <AlumnoDetallePageClient params={params} desde={desde} />;
}
