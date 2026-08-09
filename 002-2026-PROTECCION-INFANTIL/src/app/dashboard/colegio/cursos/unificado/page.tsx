import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { WizardUnificado } from "@/components/modules/colegio/unificado/WizardUnificado";

/**
 * SPEC-146 (FR-001) — Wizard unificado curso + estudiantes + identificadores.
 * `?modo=excel` (redirect de la carga vieja) abre la sección 2 en modo Excel.
 */
export default async function UnificadoPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;
    const { modo } = await searchParams;
    return <WizardUnificado modoExcelInicial={modo === "excel"} />;
}
