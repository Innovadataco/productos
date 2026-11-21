/**
 * Construye lotes y asignaciones FIFO desde las órdenes importadas (INV-SPEC-12).
 *   npm run lotes:construir
 * Idempotente. Imprime solo conteos.
 */
import { PrismaClient } from "@prisma/client";
import { construirLotes } from "../src/lotes/construir";

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const r = await construirLotes(db);
    console.log(`✅ Lotes nuevos: ${r.lotesCreados} · especies con ventas: ${r.especiesConVentas} · asignaciones FIFO: ${r.asignacionesRecalculadas}`);
    if (r.especiesSinLotes.length > 0) {
      console.log(`⚠️  ${r.especiesSinLotes.length} especie(s) con ventas que no caben en sus lotes (VENTA_SIN_LOTES): falta registrar un lote (p. ej. de escisión). Sus ventas quedan sin asignar.`);
      process.exitCode = 3;
    }
  } catch (e) {
    console.error(`❌ No se construyeron los lotes: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void main();
