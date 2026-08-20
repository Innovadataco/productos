#!/usr/bin/env node
/**
 * SPEC-182 (I-60): one-shot para reasignar operadores a los reportes huérfanos
 * legacy acumulados antes de que el worker periódico los alcance.
 *
 * Uso en producción (dentro del contenedor de la app):
 *   docker exec -it pi-app node --import tsx scripts/reasignar-huerfanos-legacy.mjs
 *
 * O desde el host con DATABASE_URL de prod cargada:
 *   node --env-file=.env.production --import tsx scripts/reasignar-huerfanos-legacy.mjs
 */

import { reconciliarHuerfanos } from "../src/lib/operadores/reconciliacion-huerfanos.ts";

async function main() {
    console.log("[REASIGNAR-HUERFANOS-LEGACY] Inicio");
    const resumen = await reconciliarHuerfanos();
    console.log("[REASIGNAR-HUERFANOS-LEGACY] Resumen:", JSON.stringify(resumen, null, 2));

    if (resumen.deshabilitado) {
        console.log("[REASIGNAR-HUERFANOS-LEGACY] Nota: job deshabilitado por parámetro");
    }

    // Salimos 0 aunque haya fallidos: el log es la señal de diagnóstico.
    process.exit(0);
}

main().catch((err) => {
    console.error("[REASIGNAR-HUERFANOS-LEGACY] Error fatal:", err);
    process.exit(1);
});
