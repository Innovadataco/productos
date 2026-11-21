/**
 * Registra el lote recibido por una escisión, con el costo del portal de Acciones & Valores (INV-SPEC-12).
 *   npm run lote:escision -- --destino <NEMO> --fecha-evento AAAA-MM-DD --cantidad <N> --costo-unitario <precio de compra del portal>
 * El evento debe estar registrado (npm run escision:registrar) y los lotes construidos (npm run
 * lotes:construir). El lote madre es el más antiguo de la especie origen vivo al corte del evento. No imprime los datos (son reales), solo el resultado.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";
import { ErrorLote, registrarLoteEscision } from "../src/lotes/escision";

let valores: Record<string, string | undefined>;
try {
  valores = parseArgs({
    strict: true, allowPositionals: false,
    options: { destino: { type: "string" }, "fecha-evento": { type: "string" }, cantidad: { type: "string" }, "costo-unitario": { type: "string" } },
  }).values;
} catch {
  console.error("❌ Argumentos inválidos. Opciones: --destino --fecha-evento --cantidad --costo-unitario");
  process.exit(2);
}

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const r = await registrarLoteEscision(db, {
      destino: valores.destino ?? "", fechaEvento: valores["fecha-evento"] ?? "",
      cantidad: valores.cantidad ?? "", costoUnitario: valores["costo-unitario"] ?? "",
    });
    console.log(`✅ Lote de escisión registrado (${r.loteId}). Corra npm run lotes:construir para recalcular las ventas.`);
  } catch (e) {
    console.error(`❌ No se registró: ${e instanceof ErrorLote ? e.codigo : "ERROR_BASE"}`);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void main();
