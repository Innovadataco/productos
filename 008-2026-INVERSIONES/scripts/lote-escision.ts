/**
 * Registra el lote recibido por una escisión, con el costo del portal de Acciones & Valores (INV-SPEC-12).
 *   npm run lote:escision -- --destino <NEMO> --fecha-evento AAAA-MM-DD --cantidad <N> --costo-unitario <precio de compra del portal>
 * El evento debe estar registrado (npm run escision:registrar) y los lotes construidos (npm run
 * lotes:construir). El lote madre es el más antiguo de la especie origen vivo al corte del evento.
 * Lee y valida los argumentos antes de abrir la base. No imprime los datos del lote (son reales): solo el id
 * interno, campos, códigos y el siguiente paso (en producción, el de la vía B). Mismo criterio de salida que
 * registrar-escision (src/cli/salida-escision.ts).
 * Salida: 0 registrado · 1 rechazado o error (código y qué hacer) · 2 argumentos o datos inválidos (no abre la base).
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";
import {
  OPCIONES_LOTE, emitir, salidaArgumentosInvalidos, salidaDatosInvalidos, salidaInesperada, salidaLoteRegistrado, salidaRechazo,
  type SalidaCli,
} from "../src/cli/salida-escision";
import { registrarLoteEscision, validarLoteEscision, type DatosLoteEscision } from "../src/lotes/escision";

// La imagen del migrador trae NODE_ENV=production: allí el siguiente paso es la vía B (cargar-prod.sh).
const opciones = { produccion: process.env.NODE_ENV === "production" };

function argumentos(): DatosLoteEscision | null {
  try {
    const { values } = parseArgs({
      strict: true, allowPositionals: false,
      options: { destino: { type: "string" }, "fecha-evento": { type: "string" }, cantidad: { type: "string" }, "costo-unitario": { type: "string" } },
    });
    return {
      destino: values.destino ?? "", fechaEvento: values["fecha-evento"] ?? "",
      cantidad: values.cantidad ?? "", costoUnitario: values["costo-unitario"] ?? "",
    };
  } catch {
    return null; // el mensaje de parseArgs puede repetir lo escrito: no se imprime
  }
}

async function main(): Promise<SalidaCli> {
  const datos = argumentos();
  if (datos === null) return salidaArgumentosInvalidos(OPCIONES_LOTE);
  const v = validarLoteEscision(datos);
  if (!v.ok) return salidaDatosInvalidos(v.errores);
  const db = new PrismaClient();
  try {
    return salidaLoteRegistrado(await registrarLoteEscision(db, datos), opciones);
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
