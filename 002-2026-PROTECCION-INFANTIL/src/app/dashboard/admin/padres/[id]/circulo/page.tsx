import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import CirculoPadreClient from "./CirculoPadreClient";

/**
 * SPEC-141 (N-1, FR-005): vista de soporte SOLO LECTURA del círculo de
 * confianza de un padre. Guarda por módulo `soporte_lectura` (default ADMIN).
 */
export default async function AdminPadreCirculoPage({ params }: { params: Promise<{ id: string }> }) {
    const acceso = await verificarAccesoPagina("soporte_lectura");
    if (!acceso.permitido) return <SinAccesoModulo />;
    const { id } = await params;
    return <CirculoPadreClient padreId={id} />;
}
