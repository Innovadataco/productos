/**
 * Trae los cierres diarios de Yahoo (.CL) de las especies con lotes (INV-SPEC-13).
 *   npm run precios:actualizar [-- --desde AAAA-MM-DD] [--hasta AAAA-MM-DD]   (por defecto, los últimos 10 días)
 * Imprime solo conteos y códigos; nunca precios ni especies.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";
import { leerFechaIso } from "../src/importacion/trii/valores";
import { actualizarPrecios } from "../src/precios/actualizar";

const DIAS_POR_DEFECTO = 10;

async function main(): Promise<void> {
  let v: { desde?: string | undefined; hasta?: string | undefined };
  try {
    v = parseArgs({ strict: true, allowPositionals: false, options: { desde: { type: "string" }, hasta: { type: "string" } } }).values;
  } catch {
    console.error("❌ Argumentos inválidos. Opciones: --desde AAAA-MM-DD --hasta AAAA-MM-DD");
    process.exit(2);
  }
  const hoy = new Date();
  const hasta = v.hasta ? leerFechaIso(v.hasta) : { ok: true as const, valor: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())) };
  const desde = v.desde ? leerFechaIso(v.desde) : hasta.ok ? { ok: true as const, valor: new Date(hasta.valor.getTime() - DIAS_POR_DEFECTO * 86_400_000) } : hasta;
  if (!hasta.ok || !desde.ok || desde.valor > hasta.valor) {
    console.error("❌ Rango de fechas inválido.");
    process.exit(2);
  }
  const db = new PrismaClient();
  try {
    const r = await actualizarPrecios(db, { desde: desde.valor, hasta: hasta.valor, buscar: fetch });
    console.log(`✅ ${r.especies} especie(s) · cierres nuevos: ${r.cierresNuevos} · revisados: ${r.cierresRevisados} · verificados en el rango: ${r.verificados}`);
    if (r.fallidas.length > 0) {
      console.log(`⚠️  ${r.fallidas.length} especie(s) sin datos de Yahoo: ${[...new Set(r.fallidas.map((f) => f.codigo))].join(", ")}`);
      process.exitCode = 3;
    }
  } catch (e) {
    console.error(`❌ No se actualizaron los precios: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void main();
