import { MisReporteDetalle } from "@/components/modules/MisReporteDetalle";

interface PageProps {
    params: Promise<{ id: string }>;
}

/**
 * Detalle privado de un reporte del usuario (spec 090, US3).
 * La verificación de ownership la hace el endpoint
 * (`GET /api/reportes/mis-reportes/[id]`, 403 si no es el dueño).
 */
export default async function MisReporteDetallePage({ params }: PageProps) {
    const { id } = await params;
    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <MisReporteDetalle reporteId={id} />
        </main>
    );
}
