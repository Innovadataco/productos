/**
 * Trae los cierres diarios de Yahoo (.CL) de las especies con lotes (INV-SPEC-13).
 *   npm run precios:actualizar [-- --desde AAAA-MM-DD] [--hasta AAAA-MM-DD]   (por defecto, los últimos 10 días)
 * Imprime conteos, códigos y el id interno de la especie fallida (con nombre y código del error, nunca su mensaje); nunca precios ni nemotécnicos.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";
import { leerFechaIso } from "../src/importacion/trii/valores";
import { actualizarPrecios } from "../src/precios/actualizar";
import { fechaEnBogota } from "../src/precios/horario";

const DIAS_POR_DEFECTO = 10;

async function main(): Promise<void> {
  let v: { desde?: string | undefined; hasta?: string | undefined };
  try {
    v = parseArgs({ strict: true, allowPositionals: false, options: { desde: { type: "string" }, hasta: { type: "string" } } }).values;
  } catch {
    console.error("❌ Argumentos inválidos. Opciones: --desde AAAA-MM-DD --hasta AAAA-MM-DD");
    process.exit(2);
  }
  const hasta = v.hasta ? leerFechaIso(v.hasta) : { ok: true as const, valor: fechaEnBogota(new Date()) };
  const desde = v.desde ? leerFechaIso(v.desde) : hasta.ok ? { ok: true as const, valor: new Date(hasta.valor.getTime() - DIAS_POR_DEFECTO * 86_400_000) } : hasta;
  if (!hasta.ok || !desde.ok || desde.valor > hasta.valor) {
    console.error("❌ Rango de fechas inválido.");
    process.exit(2);
  }
  const db = new PrismaClient();
  try {
    const r = await actualizarPrecios(db, { desde: desde.valor, hasta: hasta.valor, buscar: fetch });
    console.log(`✅ ${r.especies} especie(s) · cierres nuevos: ${r.cierresNuevos} · revisados: ${r.cierresRevisados} · verificados en el rango: ${r.verificados} · omitidas por no haber cerrado la BVC: ${r.omitidasPorHorario}`);
    if (r.fallidas.length > 0) {
      console.log(`⚠️  ${r.fallidas.length} especie(s) con fallo (Yahoo o guardado):`);
      for (const f of r.fallidas) console.log(`   · especie ${f.instrumentoId} · ${f.codigo}${f.detalle ? ` · ${f.detalle}` : ""} · barras guardadas: ${f.barrasGuardadas} · fallidas: ${f.barrasFallidas}`);
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
