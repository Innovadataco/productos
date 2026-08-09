import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import ProfesoresPageClient from "./ProfesoresPageClient";

/**
 * SPEC-148 (US1, FR-001) — Pantalla de profesores del colegio (§10 fila 7).
 * La auth la hace el layout; aquí se verifica el módulo (mismo patrón que
 * /dashboard/colegio/cursos). Consume el CRUD existente de SPEC-145 sin
 * tocarlo.
 */
export default async function ProfesoresPage() {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;
    return <ProfesoresPageClient />;
}
