/**
 * Registra un evento de escisión en la base de 008 (INV-SPEC-10). Regístrelo ANTES de cargar los
 * dividendos, para que el pago de la fracción quede como fracción y no como dividendo ordinario.
 *   npm run escision:registrar -- --origen <NEMO> --destino <NEMO> --fecha AAAA-MM-DD \
 *     [--razon 0.7] [--pago-fraccion AAAA-MM-DD] [--monto-fraccion 100.5] [--nota "por confirmar"]
 * No imprime los datos del evento (son reales), solo el resultado.
 */
import { PrismaClient } from "@prisma/client";
import { ErrorEvento, registrarEscision, validarEscision } from "../src/eventos/escision";

const OPCIONES = ["--origen", "--destino", "--fecha", "--razon", "--pago-fraccion", "--monto-fraccion", "--nota"] as const;

function argumentos(argv: readonly string[]): Record<(typeof OPCIONES)[number], string | undefined> {
  const desconocidas = argv.filter((a, i) => a.startsWith("--") && !(OPCIONES as readonly string[]).includes(a) && argv[i - 1] !== "--nota");
  if (desconocidas.length > 0) {
    console.error(`❌ Opción desconocida. Opciones: ${OPCIONES.join(" ")}`);
    process.exit(2);
  }
  const valor = (o: string) => {
    const i = argv.indexOf(o);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return Object.fromEntries(OPCIONES.map((o) => [o, valor(o)])) as Record<(typeof OPCIONES)[number], string | undefined>;
}

async function main(): Promise<void> {
  const a = argumentos(process.argv.slice(2));
  const v = validarEscision({
    origen: a["--origen"] ?? "", destino: a["--destino"] ?? "", fecha: a["--fecha"] ?? "",
    razon: a["--razon"], pagoFraccion: a["--pago-fraccion"], montoFraccion: a["--monto-fraccion"], nota: a["--nota"],
  });
  if (!v.ok) {
    console.error("❌ Datos inválidos, no se registró nada:");
    for (const e of v.errores) console.error(`   ${e.campo} · ${e.codigo}`);
    process.exit(2);
  }
  const db = new PrismaClient();
  try {
    const r = await registrarEscision(db, v.valor);
    console.log(`✅ Evento de escisión registrado (${r.eventoId}).`);
    if (r.dividendosYaImportados > 0) {
      console.log(`⚠️  Ya hay ${r.dividendosYaImportados} dividendo(s) importado(s) como ordinario(s) en la fecha del pago de la fracción: hay que revertir esa carga y volver a importarla.`);
    }
  } catch (e) {
    console.error(`❌ No se registró: ${e instanceof ErrorEvento ? e.codigo : "ERROR_BASE"}`);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void main();
