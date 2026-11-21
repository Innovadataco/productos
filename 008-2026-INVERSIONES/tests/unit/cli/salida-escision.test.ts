// Salidas de registrar-escision y lote-escision con un solo criterio (O2), sin procesos ni base: el módulo es puro.
// 0 registrado (+ siguiente paso) · 1 rechazado o error (código, campo y qué hacer) · 2 argumentos o datos
// inválidos · 3 registrado con aviso (solo registrar-escision). En producción (vía B) los pasos son los de
// cargar-prod.sh; en local, los de npm run. Nunca un valor: ni el mensaje de un error (el de Prisma lleva host:puerto).
import { describe, expect, it } from "vitest";
import {
  OPCIONES_LOTE,
  OPCIONES_REGISTRAR,
  emitir,
  salidaArgumentosInvalidos,
  salidaDatosInvalidos,
  salidaEventoRegistrado,
  salidaInesperada,
  salidaLoteRegistrado,
  salidaRechazo,
  type SalidaCli,
} from "@/cli/salida-escision";
import { ErrorEvento } from "@/eventos/escision";
import { ErrorLote } from "@/lotes/escision";

const LOCAL = { produccion: false } as const;
const PROD = { produccion: true } as const;
const MODOS = [["local", LOCAL], ["producción", PROD]] as const;
const ID = "cfictlote0000000000000000";
const todo = (s: SalidaCli) => [...s.lineas, ...s.errores].join("\n");

/** En producción, ni un `npm run`; en local, ni un `cargar-prod.sh`. */
function soloDelModo(s: SalidaCli, produccion: boolean): void {
  expect(todo(s)).not.toContain(produccion ? "npm run" : "cargar-prod.sh");
}

describe("argumentos y datos inválidos → 2, por stderr y sin abrir la base", () => {
  it("argumentos: la misma frase con las opciones de cada CLI", () => {
    expect(salidaArgumentosInvalidos(OPCIONES_REGISTRAR)).toEqual({
      codigoSalida: 2, lineas: [],
      errores: ["❌ Argumentos inválidos. Opciones: --origen --destino --fecha [--razon] [--pago-fraccion] [--monto-fraccion] [--nota] [--crear-destino]"],
    });
    expect(salidaArgumentosInvalidos(OPCIONES_LOTE).errores).toEqual(["❌ Argumentos inválidos. Opciones: --destino --fecha-evento --cantidad --costo-unitario"]);
  });

  it("datos: una línea por campo con su código (el formato de siempre de registrar-escision)", () => {
    const s = salidaDatosInvalidos([{ campo: "destino", codigo: "NEMOTECNICO_FORMATO" }, { campo: "cantidad", codigo: "DEBE_SER_POSITIVO" }]);
    expect(s).toEqual({
      codigoSalida: 2, lineas: [],
      errores: ["❌ Datos inválidos, no se registró nada:", "   destino · NEMOTECNICO_FORMATO", "   cantidad · DEBE_SER_POSITIVO"],
    });
  });
});

describe("registrado → 0 con el id interno y el siguiente paso del modo", () => {
  const evento = { eventoId: ID, destinoCreado: false, dividendosYaImportados: 0 };

  it("evento, en local: siguiente paso con npm run (demás escisiones y después los dividendos)", () => {
    const s = salidaEventoRegistrado(evento, LOCAL);
    expect(s.codigoSalida).toBe(0);
    expect(s.errores).toEqual([]);
    expect(s.lineas).toEqual([
      `✅ Evento de escisión registrado (${ID}).`,
      "➡️  Siguiente paso: registre las demás escisiones, si las hay (`npm run escision:registrar -- …`), y después cargue los dividendos con `npm run importar:trii -- --email <correo> <dividendos.csv>`.",
    ]);
  });

  it("evento, en producción: el paso de la vía B con cargar-prod.sh", () => {
    const s = salidaEventoRegistrado({ ...evento, destinoCreado: true }, PROD);
    expect(s.lineas).toEqual([
      `✅ Evento de escisión registrado (${ID}); se creó la especie destino.`,
      "➡️  Siguiente paso (vía B, §11 del runbook): registre las demás escisiones, si las hay (`cargar-prod.sh registrar-escision`), y después cargue los dividendos con `cargar-prod.sh importar-trii` y el CSV de dividendos.",
    ]);
    soloDelModo(s, true);
  });

  it.each(MODOS)("lote, en %s: siguiente paso, demás lotes y construir los lotes", (_modo, o) => {
    const s = salidaLoteRegistrado({ loteId: ID }, o);
    expect(s.codigoSalida).toBe(0);
    expect(s.errores).toEqual([]);
    expect(s.lineas[0]).toBe(`✅ Lote de escisión registrado (${ID}).`);
    expect(s.lineas[1]).toBe(o.produccion
      ? "➡️  Siguiente paso (vía B, §11 del runbook): registre los demás lotes de escisión, si los hay (`cargar-prod.sh lote-escision`), y después recalcule las ventas con `cargar-prod.sh construir-lotes`."
      : "➡️  Siguiente paso: registre los demás lotes de escisión, si los hay (`npm run lote:escision -- …`), y después recalcule las ventas con `npm run lotes:construir`.");
    expect(s.lineas).toHaveLength(2);
  });
});

describe("registrado con dividendos ya importados → 3, sin siguiente paso (lo documentado en §11)", () => {
  const conAviso = { eventoId: ID, destinoCreado: false, dividendosYaImportados: 13 };
  const AVISO = "⚠️  Ya hay 13 dividendo(s) importado(s) como ordinario(s) en la fecha del pago de la fracción: hay que revertir esa carga y volver a importarla.";

  it("en local: el aviso de siempre", () => {
    const s = salidaEventoRegistrado(conAviso, LOCAL);
    expect(s.codigoSalida).toBe(3);
    expect(s.lineas).toEqual([`✅ Evento de escisión registrado (${ID}).`, AVISO]);
  });

  it("en producción: además, que se pare la carga y se avise", () => {
    const s = salidaEventoRegistrado(conAviso, PROD);
    expect(s.codigoSalida).toBe(3);
    expect(s.lineas).toEqual([`✅ Evento de escisión registrado (${ID}).`, AVISO, "⚠️  Vía B: pare la carga y avise al CEO de 008 (§11 del runbook)."]);
    expect(todo(s)).not.toContain("Siguiente paso");
  });
});

describe("rechazado → 1, por stderr: «❌ No se registró: CÓDIGO[ (campo)] · qué significa y qué hacer»", () => {
  it.each(MODOS)("cada código de registrar-escision y lote-escision tiene su significado (%s)", (_modo, o) => {
    const casos: ReadonlyArray<readonly [Error, string]> = [
      [new ErrorEvento("INSTRUMENTO_DESCONOCIDO", "origen"), "❌ No se registró: INSTRUMENTO_DESCONOCIDO (origen) · la especie origen no está registrada (llega con las órdenes importadas): revise --origen."],
      [new ErrorEvento("INSTRUMENTO_DESCONOCIDO", "destino"), "❌ No se registró: INSTRUMENTO_DESCONOCIDO (destino) · la especie destino no está registrada: revise --destino; si solo le llegó por la escisión (no está en ninguna orden), repita con --crear-destino."],
      [new ErrorEvento("INSTRUMENTO_DESCONOCIDO"), "❌ No se registró: INSTRUMENTO_DESCONOCIDO · la especie origen o la destino no está registrada: revise --origen y --destino."],
      [new ErrorEvento("EVENTO_DUPLICADO"), "❌ No se registró: EVENTO_DUPLICADO · ese evento ya estaba registrado y no se registró otra vez (un evento registrado no se corrige con este comando)."],
      [new ErrorEvento("PAGO_FRACCION_DUPLICADO"), "❌ No se registró: PAGO_FRACCION_DUPLICADO · ese pago de fracción ya es de otro evento: no se registró nada."],
      [new ErrorLote("EVENTO_AMBIGUO"), "❌ No se registró: EVENTO_AMBIGUO · hay más de un evento de escisión con ese destino en esa fecha: este comando no elige uno; avise."],
      [new ErrorLote("LOTE_YA_REGISTRADO"), "❌ No se registró: LOTE_YA_REGISTRADO · ese evento ya tiene su lote de escisión y no se registró otro."],
    ];
    for (const [e, texto] of casos) {
      const s = salidaRechazo(e, o);
      expect(s).toEqual({ codigoSalida: 1, lineas: [], errores: [texto] });
    }
  });

  it("el origen desconocido no ofrece --crear-destino (no crea el origen)", () => {
    expect(todo(salidaRechazo(new ErrorEvento("INSTRUMENTO_DESCONOCIDO", "origen"), LOCAL))).not.toContain("--crear-destino");
  });

  it.each(MODOS)("EVENTO_NO_ENCONTRADO y SIN_LOTE_MADRE dicen el comando que falta, en el modo (%s)", (_modo, o) => {
    const noEncontrado = salidaRechazo(new ErrorLote("EVENTO_NO_ENCONTRADO"), o);
    const sinMadre = salidaRechazo(new ErrorLote("SIN_LOTE_MADRE"), o);
    const [registrar, construir] = o.produccion
      ? ["`cargar-prod.sh registrar-escision`", "`cargar-prod.sh construir-lotes`"]
      : ["`npm run escision:registrar -- …`", "`npm run lotes:construir`"];
    expect(noEncontrado.errores).toEqual([
      `❌ No se registró: EVENTO_NO_ENCONTRADO · no hay un evento de escisión con ese destino en esa fecha: revise --destino y --fecha-evento, o registre antes el evento (${registrar}).`,
    ]);
    expect(sinMadre.errores).toEqual([
      `❌ No se registró: SIN_LOTE_MADRE · la especie origen no tiene un lote vivo en la fecha del evento: construya antes los lotes (${construir}) o revise --fecha-evento.`,
    ]);
    for (const s of [noEncontrado, sinMadre]) {
      expect(s.codigoSalida).toBe(1);
      soloDelModo(s, o.produccion);
    }
  });

  it("los DATOS_INVALIDOS de registrarLoteEscision (no llegan desde el CLI, que valida antes) salen con el código solo", () => {
    expect(salidaRechazo(new ErrorLote("DATOS_INVALIDOS:cantidad,costoUnitario"), LOCAL).errores).toEqual(["❌ No se registró: DATOS_INVALIDOS:cantidad,costoUnitario"]);
  });

  it("un error que no es del dominio: ERROR_BASE y la clase, nunca el mensaje", () => {
    const prisma = Object.assign(new Error("Can't reach database server at 127.0.0.1:5438 FICTA 98765"), { name: "PrismaClientInitializationError" });
    const s = salidaRechazo(prisma, PROD);
    expect(s).toEqual({ codigoSalida: 1, lineas: [], errores: ["❌ No se registró: ERROR_BASE · PrismaClientInitializationError"] });
    expect(salidaRechazo("no es un Error", LOCAL).errores).toEqual(["❌ No se registró: ERROR_BASE · error"]);
  });

  it("una clase con forma rara (espacios, datos) no se imprime: sale «error»", () => {
    const raro = Object.assign(new Error("x"), { name: "FICTA 98765 · 127.0.0.1" });
    expect(salidaRechazo(raro, LOCAL).errores).toEqual(["❌ No se registró: ERROR_BASE · error"]);
  });
});

describe("error inesperado fuera del registro → 1: no promete que no se registró", () => {
  it.each(MODOS)("dice la clase y que hay que revisar antes de repetir (%s)", (_modo, o) => {
    const e = Object.assign(new Error("FICTA 98765 127.0.0.1:5438"), { name: "PrismaClientUnknownRequestError" });
    const s = salidaInesperada(e, o);
    expect(s.codigoSalida).toBe(1);
    expect(s.lineas).toEqual([]);
    expect(s.errores).toEqual([o.produccion
      ? "❌ Error inesperado: PrismaClientUnknownRequestError. No se pudo confirmar si quedó registrado: pare la carga y avise al CEO de 008 (§11 del runbook)."
      : "❌ Error inesperado: PrismaClientUnknownRequestError. No se pudo confirmar si quedó registrado: revíselo antes de repetir."]);
    expect(todo(s)).not.toContain("No se registró:");
  });

  it("un valor que no es Error", () => {
    expect(salidaInesperada(undefined, LOCAL).errores[0]).toMatch(/^❌ Error inesperado: error\. /);
  });
});

describe("emitir", () => {
  it("escribe las líneas por stdout y los errores por stderr, en orden, y devuelve el código de salida", () => {
    const vistas: string[] = [];
    const consola = { log: (l: string) => vistas.push(`out:${l}`), error: (l: string) => vistas.push(`err:${l}`) };
    expect(emitir({ codigoSalida: 3, lineas: ["a", "b"], errores: ["c"] }, consola)).toBe(3);
    expect(vistas).toEqual(["out:a", "out:b", "err:c"]);
  });
});
