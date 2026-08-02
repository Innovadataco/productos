import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import EstructuraColegioClient from "./EstructuraColegioClient";

/**
 * SPEC-141 (N-1, FR-005): vista de soporte SOLO LECTURA de la estructura del
 * colegio (cursos y alumnos). Guarda por módulo `soporte_lectura` (default ADMIN).
 */
export default async function AdminColegioEstructuraPage({ params }: { params: Promise<{ id: string }> }) {
    const acceso = await verificarAccesoPagina("soporte_lectura");
    if (!acceso.permitido) return <SinAccesoModulo />;
    const { id } = await params;
    return <EstructuraColegioClient colegioId={id} />;
}
