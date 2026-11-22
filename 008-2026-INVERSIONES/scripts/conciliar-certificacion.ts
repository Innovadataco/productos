/**
 * Vuelve a conciliar la certificación de A&V de una fecha de corte (por ejemplo, después de traer los cierres de
 * ese día con `npm run precios:actualizar -- --desde <corte>` o de registrar lotes, unidades del fondo o ajustes).
 *   npx tsx scripts/conciliar-certificacion.ts --fecha-corte AAAA-MM-DD
 * Guarda una conciliación nueva (la anterior queda en la historia). Si los precios dicen que la certificación es del
 * cierre del día hábil anterior (fecha_corte_dudosa con fecha sugerida), dice cómo corregir el corte. Usa DATABASE_URL. Imprime solo el resultado,
 * conteos y códigos de motivo, nunca cifras ni especies.
 */
import { PrismaClient } from "@prisma/client";
import { conciliarCertificacion, ErrorConciliacion } from "../src/conciliacion/conciliar";
import { ErrorArgumentosAv, leerArgumentosConciliar, type ArgumentosConciliar } from "../src/importacion/av/argumentos";
import { lineasDeConciliacion } from "../src/importacion/av/salida";

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
    // Si sugiere otro corte, dice cómo corregirlo; en producción (NODE_ENV=production), por cargar-prod.sh.
    for (const linea of lineasDeConciliacion(c, process.env.NODE_ENV === "production")) console.log(linea);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  if (e instanceof ErrorConciliacion && e.codigo === "CERTIFICACION_RETIRADA") {
    console.error(`❌ CERTIFICACION_RETIRADA · la certificación de esa fecha se retiró (se cargó con otro corte): su corte real es ${e.reemplazo}. Concilie con \`--fecha-corte ${e.reemplazo}\`.`);
    process.exit(1);
  }
  const codigo = e instanceof Error && "codigo" in e ? ` (${String((e as { codigo: unknown }).codigo)})` : "";
  console.error(`❌ La conciliación falló: ${e instanceof Error ? e.name : "error"}${codigo}`);
  process.exit(1);
});
