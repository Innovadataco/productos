import Topbar from "@/components/bi/Topbar";
import BitacoraPanel from "@/components/bi/BitacoraPanel";

// Datos en vivo en cada request: nunca prerender estático.
export const dynamic = "force-dynamic";

/**
 * Bitácora del chat (SPEC-006 · Lote 3 · AGENTE C): observabilidad global
 * del motor — cada pregunta con estado, latencia, cache y traza completa.
 * El panel es cliente (filtros/paginación reactivos) y consume
 * GET /api/bi/bitacora + GET /api/bi/consultas/[id] para el drill-down.
 * Sub-pantalla de Admin IA: el tab activo del Topbar queda en "admin-ia".
 */
export default function AdminBitacoraPage() {
    return (
        <main className="relative z-10 max-w-[1180px] mx-auto px-6 pt-8 pb-20">
            <Topbar
                titulo="Bitácora del"
                acento="chat"
                activo="admin-ia"
                sub="Cada pregunta al motor: estado, latencia y traza completa"
            />
            <BitacoraPanel />
        </main>
    );
}
