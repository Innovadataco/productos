import { Suspense } from "react";
import { Cargando } from "@/components/ui/Cargando";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { EstadisticasSubNav } from "../components/EstadisticasSubNav";
import { OperacionTableroClient } from "./OperacionTableroClient";

/**
 * SPEC-571 (I-353): guardia A NIVEL PÁGINA que ESPEJA EL PAR de su API. El
 * cliente consume /api/admin/monitoreo/estado → verifyAuth("ADMIN") +
 * assertModulo("estadisticas"), así que la página exige rol ADMIN Y módulo
 * "estadisticas" (el módulo, no "monitoreo"). Hoy "estadisticas" es mono-rol y
 * el módulo solo coincidiría, pero la API fija ADMIN explícito: el par es la
 * copia fiel y aguanta que el grant se ensanche. Antes rendía el cascarón a
 * cualquier autenticado (el dato daba 403, pero la pantalla se veía).
 */
export default async function AdminEstadisticasOperacionPage() {
    const acceso = await verificarAccesoPagina("estadisticas");
    if (!acceso.permitido || acceso.rol !== "ADMIN") return <SinAccesoModulo />;
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* SPEC-179 (I-59): sub-nav del área (Operación · Clasificación · Motor). */}
            <Suspense fallback={null}>
                <EstadisticasSubNav />
            </Suspense>
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Tablero operativo</h1>
                <p className="text-sm text-muted">Salud de la infraestructura y operación de reportes en un solo lugar.</p>
            </div>
            {/* Suspense: OperacionTableroClient lee el tab activo con useSearchParams */}
            <Suspense fallback={<Cargando texto="Cargando tablero..." />}>
                <OperacionTableroClient />
            </Suspense>
        </div>
    );
}
