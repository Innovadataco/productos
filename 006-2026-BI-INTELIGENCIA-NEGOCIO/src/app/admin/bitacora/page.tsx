import Topbar from "@/components/bi/Topbar";
import BitacoraPanel from "@/components/bi/BitacoraPanel";

// Datos en vivo en cada request: nunca prerender estático.
export const dynamic = "force-dynamic";

/**
 * Bitácora de BI (SPEC-006 · Lote 3 · AGENTE C + bitácora general 2026-09-02):
 * observabilidad global del producto en dos vistas:
 *   · Chat    — cada pregunta al motor: estado, latencia, cache y traza.
 *   · Eventos — gobierno: ingresos (OK/fallidos), cambios de config,
 *               exportaciones.
 * El panel es cliente (filtros/paginación reactivos) y consume
 * GET /api/bi/bitacora + GET /api/bi/consultas/[id] para el drill-down.
 * Sub-pantalla de Admin IA: el tab activo del Topbar queda en "admin-ia".
 */
export default function AdminBitacoraPage() {
    return (
        <main className="relative z-10 max-w-[1180px] mx-auto px-6 pt-8 pb-20">
            <Topbar
                titulo="Bitácora de"
                acento="BI"
                activo="admin-ia"
                sub="Chat: cada consulta al motor · Eventos: ingresos, cambios de config y exportaciones"
            />
            <BitacoraPanel />
        </main>
    );
}
