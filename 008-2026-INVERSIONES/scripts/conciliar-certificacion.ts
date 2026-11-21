/**
 * Vuelve a conciliar la certificación de A&V de una fecha de corte (por ejemplo, después de traer los cierres de
 * ese día con `npm run precios:actualizar -- --desde <corte>` o de registrar lotes, unidades del fondo o ajustes).
 *   npx tsx scripts/conciliar-certificacion.ts --fecha-corte AAAA-MM-DD
 * Guarda una conciliación nueva (la anterior queda en la historia). Usa DATABASE_URL. Imprime solo el resultado,
 * conteos y códigos de motivo, nunca cifras ni especies.
 */
import { PrismaClient } from "@prisma/client";
import { conciliarCertificacion } from "../src/conciliacion/conciliar";
import { ErrorArgumentosAv, leerArgumentosConciliar, type ArgumentosConciliar } from "../src/importacion/av/argumentos";
import { lineaDeConciliacion } from "../src/importacion/av/salida";

const USO = "Uso: npx tsx scripts/conciliar-certificacion.ts --fecha-corte AAAA-MM-DD";

function argumentos(): ArgumentosConciliar {
  try {
    return leerArgumentosConciliar(process.argv.slice(2));
  } catch (e) {
    console.error(`❌ ${e instanceof ErrorArgumentosAv ? e.codigo : "ARGUMENTOS_INVALIDOS"}\n${USO}`);
    process.exit(2);
  }
}

async function main(): Promise<void> {
  const a = argumentos();
  const db = new PrismaClient();
  try {
    const c = await conciliarCertificacion(db, { fechaCorte: a.fechaCorte });
    console.log(lineaDeConciliacion(c));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  const codigo = e instanceof Error && "codigo" in e ? ` (${String((e as { codigo: unknown }).codigo)})` : "";
  console.error(`❌ La conciliación falló: ${e instanceof Error ? e.name : "error"}${codigo}`);
  process.exit(1);
});
