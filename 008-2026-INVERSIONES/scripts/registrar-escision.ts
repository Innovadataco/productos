/**
 * Registra un evento de escisión en la base de 008 (INV-SPEC-10). Regístrelo ANTES de cargar los
 * dividendos, para que el pago de la fracción quede como fracción y no como dividendo ordinario.
 *   npm run escision:registrar -- --origen <NEMO> --destino <NEMO> --fecha AAAA-MM-DD \
 *     [--razon 0.7] [--pago-fraccion AAAA-MM-DD] [--monto-fraccion 100.5] [--nota "por confirmar"] [--crear-destino]
 * --crear-destino: crea la especie destino si no existe (solo para especies que llegan por escisión).
 * No imprime los datos del evento (son reales), solo el resultado.
 * Salida: 0 registrado · 1 rechazado por la base · 2 datos inválidos · 3 registrado, pero hay
 * dividendos ya importados como ordinarios que hay que revertir.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";
import { ErrorEvento, registrarEscision, validarEscision } from "../src/eventos/escision";

function argumentos() {
  try {
    const { values } = parseArgs({
      strict: true,
      allowPositionals: false,
      options: {
        origen: { type: "string" }, destino: { type: "string" }, fecha: { type: "string" }, razon: { type: "string" },
        "pago-fraccion": { type: "string" }, "monto-fraccion": { type: "string" }, nota: { type: "string" },
        "crear-destino": { type: "boolean" },
      },
    });
    return values;
  } catch {
    console.error("❌ Argumentos inválidos. Opciones: --origen --destino --fecha [--razon] [--pago-fraccion] [--monto-fraccion] [--nota] [--crear-destino]");
    process.exit(2);
  }
}

async function main(): Promise<void> {
  const a = argumentos();
  const v = validarEscision({
    origen: a.origen ?? "", destino: a.destino ?? "", fecha: a.fecha ?? "",
    razon: a.razon, pagoFraccion: a["pago-fraccion"], montoFraccion: a["monto-fraccion"], nota: a.nota,
  });
  if (!v.ok) {
    console.error("❌ Datos inválidos, no se registró nada:");
    for (const e of v.errores) console.error(`   ${e.campo} · ${e.codigo}`);
    process.exit(2);
  }
  const db = new PrismaClient();
  try {
    const r = await registrarEscision(db, v.valor, { crearDestino: a["crear-destino"] === true });
    console.log(`✅ Evento de escisión registrado (${r.eventoId})${r.destinoCreado ? "; se creó la especie destino" : ""}.`);
    if (r.dividendosYaImportados > 0) {
      console.log(`⚠️  Ya hay ${r.dividendosYaImportados} dividendo(s) importado(s) como ordinario(s) en la fecha del pago de la fracción: hay que revertir esa carga y volver a importarla.`);
      process.exitCode = 3;
    }
  } catch (e) {
    console.error(`❌ No se registró: ${e instanceof ErrorEvento ? e.codigo : "ERROR_BASE"}`);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void main();
