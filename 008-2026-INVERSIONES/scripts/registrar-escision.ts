/**
 * Registra un evento de escisión en la base de 008 (INV-SPEC-10). Regístrelo ANTES de cargar los
 * dividendos, para que el pago de la fracción quede como fracción y no como dividendo ordinario.
 *   npm run escision:registrar -- --origen <NEMO> --destino <NEMO> --fecha AAAA-MM-DD \
 *     [--razon 0.7] [--pago-fraccion AAAA-MM-DD] [--monto-fraccion 100.5] [--nota "por confirmar"] [--crear-destino]
 * --crear-destino: crea la especie destino si no existe (solo para especies que llegan por escisión).
 * Lee y valida los argumentos antes de abrir la base. No imprime los datos del evento (son reales): solo el id
 * interno, conteos, campos, códigos y el siguiente paso (en producción, el de la vía B). Mismo criterio de salida
 * que lote-escision (src/cli/salida-escision.ts).
 * Salida: 0 registrado · 1 rechazado o error (código y qué hacer) · 2 argumentos o datos inválidos (no abre la
 * base) · 3 registrado, pero hay dividendos ya importados como ordinarios que hay que revertir.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";
import {
  OPCIONES_REGISTRAR, emitir, salidaArgumentosInvalidos, salidaDatosInvalidos, salidaEventoRegistrado, salidaInesperada, salidaRechazo,
  type SalidaCli,
} from "../src/cli/salida-escision";
import { registrarEscision, validarEscision } from "../src/eventos/escision";

// La imagen del migrador trae NODE_ENV=production: allí el siguiente paso es la vía B (cargar-prod.sh).
const opciones = { produccion: process.env.NODE_ENV === "production" };

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
    return null; // el mensaje de parseArgs puede repetir lo escrito: no se imprime
  }
}

async function main(): Promise<SalidaCli> {
  const a = argumentos();
  if (a === null) return salidaArgumentosInvalidos(OPCIONES_REGISTRAR);
  const v = validarEscision({
    origen: a.origen ?? "", destino: a.destino ?? "", fecha: a.fecha ?? "",
    razon: a.razon, pagoFraccion: a["pago-fraccion"], montoFraccion: a["monto-fraccion"], nota: a.nota,
  });
  if (!v.ok) return salidaDatosInvalidos(v.errores);
  const db = new PrismaClient();
  try {
    return salidaEventoRegistrado(await registrarEscision(db, v.valor, { crearDestino: a["crear-destino"] === true }), opciones);
  } catch (e) {
    return salidaRechazo(e, opciones);
  } finally {
    await db.$disconnect();
  }
}

// exitCode y no exit(): en macOS stdout por tubería es asíncrono y exit() podría cortar la salida.
main().then(
  (s) => {
    process.exitCode = emitir(s, console);
  },
  (e: unknown) => {
    process.exitCode = emitir(salidaInesperada(e, opciones), console);
  },
);
