/**
 * 002-PI-051 (B1) — Guarda de provisioning: importa el catálogo geográfico
 * GeoNames SOLO si la BD lo necesita. Idempotente y rápido cuando está sana
 * (el import completo descarga ~20 países: no debe correr en cada deploy).
 *
 * Criterio de "necesita import": hay ciudades con `nombreNormalizado` vacío
 * (datos pre-SPEC-115: el buscador filtra por ese campo y no lista nada) o el
 * catálogo es muy pequeño (< 500 ciudades). El importador
 * (`scripts/importar-geonames.ts`) es idempotente: upsert por geonameId,
 * enriquece las preexistentes y nunca borra.
 *
 * Cableado en deploy-prod.sh tras el sync de módulos/grants (002-PI-048).
 */
import { execFileSync } from "node:child_process";
import { prisma } from "../src/lib/prisma";

const MIN_CIUDADES_SANO = 500;

async function main() {
    const [sinNormalizar, total] = await Promise.all([
        prisma.ciudad.count({ where: { nombreNormalizado: "" } }),
        prisma.ciudad.count(),
    ]);

    if (sinNormalizar === 0 && total >= MIN_CIUDADES_SANO) {
        console.log(`[GeoGuard] Catálogo geográfico sano (${total} ciudades, todas normalizadas) — nada que hacer.`);
        return;
    }

    console.log(`[GeoGuard] Catálogo incompleto (${total} ciudades, ${sinNormalizar} sin normalizar) — importando GeoNames…`);
    execFileSync(process.execPath, ["--import", "tsx", "scripts/importar-geonames.ts"], {
        stdio: "inherit",
        cwd: process.cwd(),
        env: process.env,
    });
    console.log("[GeoGuard] Importación terminada.");
}

main()
    .catch((err: unknown) => {
        console.error("[GeoGuard] Error:", err instanceof Error ? err.message : err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
