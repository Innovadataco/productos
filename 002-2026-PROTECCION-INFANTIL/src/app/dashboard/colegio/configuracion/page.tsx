import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import ConfiguracionPageClient from "./ConfiguracionPageClient";

/**
 * SPEC-149 (US4, FR-007) — Pantalla de configuración de avisos del colegio
 * (§10 fila 8). La auth la hace el layout; aquí se verifica el módulo (mismo
 * patrón que /dashboard/colegio/profesores de SPEC-148).
 */
export default async function ConfiguracionPage() {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;
    return <ConfiguracionPageClient />;
}
