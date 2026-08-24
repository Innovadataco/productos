import { Suspense } from "react";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { PagosAnaliticaRepository } from "@/lib/dal/repositories/pagos-analitica-repository";
import { AnaliticaPagosService } from "@/lib/pagos/analitica.service";
import { obtenerCacheAnaliticaSegundos } from "@/lib/pagos/parametros-pagos";
import { EstadisticasSubNav } from "../components/EstadisticasSubNav";
import { KpiPagosCards } from "@/components/modules/admin/pagos/analitica/KpiPagosCards";
import { WidgetVencimientosSemana } from "@/components/modules/admin/pagos/analitica/WidgetVencimientosSemana";
import { WidgetMoraLarga } from "@/components/modules/admin/pagos/analitica/WidgetMoraLarga";
import { WidgetPadresPagantesColegiosCaidos } from "@/components/modules/admin/pagos/analitica/WidgetPadresPagantesColegiosCaidos";
import { WidgetCrecimientoPaisCiudad } from "@/components/modules/admin/pagos/analitica/WidgetCrecimientoPaisCiudad";

/**
 * SPEC-218 (002-PI-118): tab "Dinero vs Valor" del área Estadísticas (D-72).
 * Reemplaza el stub de analítica dejado por SPEC-212 en /dashboard/admin/pagos/
 * analitica (esa ruta ahora redirige aquí). KPIs BRIEF §9.2 + 4 widgets §9.1,
 * sin IA (FR-010), paleta ambar (D-74). La caché por widget (60 s por defecto,
 * `pagos.analitica.cache_segundos`) la aplica el servicio (FR-006).
 */
export default async function DineroVsValorPage() {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const cacheSegundos = await obtenerCacheAnaliticaSegundos();
    const data = await new AnaliticaPagosService(new PagosAnaliticaRepository(), { cacheSegundos }).obtenerAnalitica();

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <Suspense fallback={null}>
                <EstadisticasSubNav />
            </Suspense>
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Dinero vs Valor</h1>
                <p className="text-sm text-muted">
                    Analítica del Módulo Pagos para actuar a tiempo: vencimientos, mora, rescates y crecimiento.
                </p>
            </div>

            <KpiPagosCards kpi={data.kpi} />

            {/* FR-009: 1 columna mobile, 2 tablet, 4 desktop. */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <WidgetVencimientosSemana data={data.widgets.vencimientosEstaSemana} />
                <WidgetMoraLarga data={data.widgets.moraLarga} />
                <WidgetPadresPagantesColegiosCaidos data={data.widgets.padresPagantesColegiosCaidos} />
                <WidgetCrecimientoPaisCiudad data={data.widgets.crecimientoPaisCiudad} />
            </div>
        </div>
    );
}
