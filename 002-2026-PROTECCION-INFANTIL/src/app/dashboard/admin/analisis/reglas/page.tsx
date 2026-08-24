import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { ReglasPanel } from "@/components/modules/analisis/ReglasPanel";

/**
 * SPEC-224 (002-PI-125, FR-001/FR-002): panel de reglas configurables del
 * motor de recomendaciones (Análisis dinero-vs-valor). Tabla del catálogo,
 * editor con SQL preview + test en solo lectura, promoción RECOMIENDA→EJECUTA
 * con confirmación fuerte (D-77) y versionado con historial auditable.
 * Server Component: la protección fina es el módulo `analisis_admin`
 * (otorgado solo a ADMIN), no el rol del layout.
 */
export const dynamic = "force-dynamic";

export default async function ReglasConfigurablesPage() {
    const acceso = await verificarAccesoPagina("analisis_admin");
    if (!acceso.permitido) return <SinAccesoModulo />;

    return (
        <div className="space-y-6 p-6">
            <header>
                <h2 className="text-xl font-bold text-body">Análisis · Reglas</h2>
                <p className="mt-1 text-sm text-muted">
                    Catálogo de reglas del motor de recomendaciones: crea, prueba y calibra reglas SQL sin
                    deploy. Las reglas en modo Recomienda generan sugerencias; en modo Ejecuta sola actúan
                    sin intervención (la promoción exige confirmación y queda auditada).
                </p>
            </header>
            <ReglasPanel />
        </div>
    );
}
