import { procesarReporte } from "@/lib/dal/services/reporte-processing";

/**
 * POST /api/reportes/procesar — endpoint interno del worker (X-Worker-Secret).
 * SPEC-053: la orquestación del pipeline y las transacciones viven en
 * `ReporteProcessingService` (DAL); la ruta solo delega.
 */
export async function POST(request: Request) {
    return procesarReporte(request);
}
