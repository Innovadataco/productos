import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { AnalisisRecomendacionesService } from "@/lib/dal/services/analisis-recomendaciones";
import { HistorialRecomendaciones } from "./components/HistorialRecomendaciones";

/**
 * SPEC-227 (002-PI-128, FR-009): historial de sugerencias del motor de reglas
 * con métricas de tuning. Vista de SOLO LECTURA (la resolución vive en
 * SPEC-221/226). Server Component: la protección fina es el módulo
 * `analisis_recomendaciones` (otorgado solo a ADMIN), no el rol del layout.
 */
export const dynamic = "force-dynamic";

export default async function HistorialRecomendacionesPage() {
    const acceso = await verificarAccesoPagina("analisis_recomendaciones");
    if (!acceso.permitido) return <SinAccesoModulo />;

    const reglas = await new AnalisisRecomendacionesService().listarReglasParaFiltro();

    return (
        <div className="space-y-6 p-6">
            <header>
                <h2 className="text-xl font-bold text-body">Historial de sugerencias</h2>
                <p className="mt-1 text-sm text-muted">
                    Auditoría del motor de reglas: qué sugirió el sistema, qué pasó con cada sugerencia y
                    métricas para calibrar umbrales. Las métricas miden el desempeño de las reglas, nunca
                    de clientes ni personas.
                </p>
            </header>
            <HistorialRecomendaciones reglas={reglas} />
        </div>
    );
}
