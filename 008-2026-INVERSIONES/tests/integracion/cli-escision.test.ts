// registrar-escision y lote-escision como proceso contra la base de PRUEBAS (O2): las salidas con un solo criterio.
// 0 registrado con el id interno y el siguiente paso del modo (local: npm run; producción, NODE_ENV=production como
// el migrador: cargar-prod.sh, vía B) · 1 rechazado con el código, el campo si aplica y qué hacer · 3 (solo
// registrar-escision) registrado con dividendos ya importados como ordinarios, sin siguiente paso. Nunca un dato.
// Base compartida y orden no garantizado: cada prueba crea sus datos (`FICT…` por corrida) y solo afirma sobre ellos.
// Los 2 y el ERROR_BASE (sin base) están en tests/unit/cli/escision-proceso.test.ts. Datos inventados.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POR_CLI_MS, comprobar as comprobarSalida, correr as correrCli, entornoMinimo, type Salida } from "../ayudas/cli";

const db = new PrismaClient();
const URL_BASE = process.env.DATABASE_URL ?? "";
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const nemo = (base: string) => `FICT${base}${corrida}`.replace(/[^A-Z0-9]/g, "").slice(0, 20);
const duenoEmail = `dueno-cli-esc-${corrida.toLowerCase()}@ejemplo.invalid`;
const FECHA = "2027-03-17";
const PAGO = "2027-03-24";
const ORDENES =
  "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
const POR_PRUEBA = { timeout: 6 * POR_CLI_MS };
const PROD = { NODE_ENV: "production" };
let carpeta = "";

const clavesDeLaCorrida = (): Record<string, string> =>
  Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith("CIFRADO_CLAVE_") && v !== undefined)) as Record<string, string>;
const correr = (script: string, args: readonly string[], extra: Record<string, string> = {}): Salida =>
  correrCli(script, args, entornoMinimo({ DATABASE_URL: URL_BASE, ...clavesDeLaCorrida(), ...extra }));
const comprobar = (s: Salida, codigo: number, esperado: string, datos: readonly string[]): void =>
  comprobarSalida(s, codigo, esperado, [...datos, URL_BASE, "postgresql://"]);

/** En producción, ni un `npm run`; en local, ni un `cargar-prod.sh`. */
const soloDelModo = (s: Salida, produccion: boolean): void => expect(s.texto).not.toContain(produccion ? "npm run" : "cargar-prod.sh");
/** En producción, todo fallo (salida distinta de 0) termina pidiendo parar la carga y avisar (§11). */
const PARE = "⚠️  Vía B: pare la carga y avise al CEO de 008 (§11 del runbook).";

function archivo(nombre: string, contenido: string): string {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
}

const origenSuelto = (n: string) => db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: n, nombre: "Origen ficticio" } });

/** La compra de la especie origen y su lote, armados a mano (sin pasar por construir-lotes). */
async function loteMadre(origen: string): Promise<void> {
  const ruta = archivo(`madre-${origen}.ficticio.csv`, `${ORDENES}"13 ene 2027, 10:00 a. m.",${origen},Compra,Aprobado,37,0,41.3,1528.1,4.7,1532.8\n`);
  expect(correr("importar-trii.ts", ["--email", duenoEmail, ruta]).codigo).toBe(0);
  const c = await db.orden.findFirstOrThrow({ where: { instrumento: { nemotecnico: origen } } });
  await db.lote.create({
    data: {
      instrumentoId: c.instrumentoId, origen: "COMPRA", ordenId: c.id, fuenteCosto: "TRII_ORDEN",
      fechaCompra: c.fechaOperacion, fechaLiquidacion: c.fechaLiquidacion,
      cantidad: c.cantidadCompletada, costoUnitario: c.precioUnitario, costoTotal: c.totalInvertido, comision: c.comision,
    },
  });
}

const eventoArgs = (origen: string, destino: string, ...mas: string[]) => ["--origen", origen, "--destino", destino, "--fecha", FECHA, ...mas];
const loteArgs = (destino: string) => ["--destino", destino, "--fecha-evento", FECHA, "--cantidad", "4613", "--costo-unitario", "1237.53"];

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  carpeta = mkdtempSync(join(tmpdir(), "inv008-cli-esc-"));
  await db.usuario.create({ data: { email: duenoEmail, rol: "DUENO" } });
});

afterAll(async () => {
  rmSync(carpeta, { recursive: true, force: true });
  await db.$disconnect();
});

describe("CLI registrar-escision · salidas (O2)", POR_PRUEBA, () => {
  it("0 en local: el id del evento y el siguiente paso con npm run; al repetirlo, 1 EVENTO_DUPLICADO con su significado", async () => {
    const [origen, destino] = [nemo("RO"), nemo("RD")];
    await origenSuelto(origen);
    const args = eventoArgs(origen, destino, "--razon", "0.4613", "--nota", "nota ficticia del evento", "--crear-destino");
    const datos = [origen, destino, FECHA, "0.4613", "nota ficticia"];
    const s = correr("registrar-escision.ts", args);
    comprobar(s, 0, "➡️  Siguiente paso: registre las demás escisiones", datos);
    const id = (await db.eventoCorporativo.findFirstOrThrow({ where: { origen: { nemotecnico: origen } } })).id;
    expect(s.texto).toContain(`✅ Evento de escisión registrado (${id}); se creó la especie destino.`);
    expect(s.texto).toContain("`npm run importar:trii -- --email <correo> <dividendos.csv>`");
    soloDelModo(s, false);
    comprobar(correr("registrar-escision.ts", args), 1, "❌ No se registró: EVENTO_DUPLICADO · ese evento ya estaba registrado", datos);
  });

  it("0 en producción: el siguiente paso de la vía B, con cargar-prod.sh", async () => {
    const [origen, destino] = [nemo("PO"), nemo("PD")];
    await origenSuelto(origen);
    const s = correr("registrar-escision.ts", eventoArgs(origen, destino, "--crear-destino"), PROD);
    comprobar(s, 0, "➡️  Siguiente paso (vía B, §11 del runbook): registre las demás escisiones", [origen, destino, FECHA]);
    expect(s.texto).toContain("`cargar-prod.sh importar-trii`");
    soloDelModo(s, true);
  });

  it("1 con el campo: el origen desconocido no ofrece --crear-destino; el destino desconocido sí, y no se crea", async () => {
    const [origen, destino] = [nemo("UO"), nemo("UD")];
    const sinOrigen = correr("registrar-escision.ts", eventoArgs(nemo("XO"), destino));
    comprobar(sinOrigen, 1, "❌ No se registró: INSTRUMENTO_DESCONOCIDO (origen) · la especie origen no está registrada", [nemo("XO"), destino, FECHA]);
    expect(sinOrigen.texto).not.toContain("--crear-destino");
    await origenSuelto(origen);
    const sinDestino = correr("registrar-escision.ts", eventoArgs(origen, destino));
    comprobar(sinDestino, 1, "❌ No se registró: INSTRUMENTO_DESCONOCIDO (destino) · la especie destino no está registrada", [origen, destino, FECHA]);
    expect(sinDestino.texto).toContain("repita con --crear-destino");
    expect(await db.instrumento.count({ where: { nemotecnico: destino } })).toBe(0);
  });

  it("3 con un dividendo ya importado como ordinario: el aviso y sin siguiente paso; en producción, pare la carga", async () => {
    for (const [sufijo, extra] of [["L", {}], ["P", PROD]] as const) {
      const [origen, destino] = [nemo(`TO${sufijo}`), nemo(`TD${sufijo}`)];
      await origenSuelto(origen);
      const div = archivo(`div-${destino}.ficticio.csv`, `Fecha y hora,Ticker,Estado,Valor total\n${PAGO},${destino},,4613.37\n`);
      expect(correr("importar-trii.ts", ["--email", duenoEmail, div]).codigo).toBe(0);
      const s = correr("registrar-escision.ts", eventoArgs(origen, destino, "--pago-fraccion", PAGO, "--monto-fraccion", "4613.37"), extra);
      comprobar(s, 3, "⚠️  Ya hay 1 dividendo(s) importado(s) como ordinario(s)", [origen, destino, FECHA, PAGO, "4613"]);
      expect(s.texto).toContain("✅ Evento de escisión registrado (");
      expect(s.texto).not.toContain("Siguiente paso");
      expect(s.texto.includes(PARE), s.texto).toBe(sufijo === "P");
      expect(s.texto.includes("hay que revertir esa carga"), s.texto).toBe(sufijo === "L");
    }
  });
});

describe("CLI lote-escision · salidas (O2)", POR_PRUEBA, () => {
  it("1 EVENTO_NO_ENCONTRADO: dice cómo registrar el evento, en el modo", () => {
    const destino = nemo("NE");
    const datos = [destino, FECHA, "4613", "1237"];
    const local = correr("lote-escision.ts", loteArgs(destino));
    comprobar(local, 1, "❌ No se registró: EVENTO_NO_ENCONTRADO · no hay un evento de escisión con ese destino en esa fecha", datos);
    expect(local.texto).toContain("`npm run escision:registrar -- …`");
    const prod = correr("lote-escision.ts", loteArgs(destino), PROD);
    comprobar(prod, 1, "❌ No se registró: EVENTO_NO_ENCONTRADO", datos);
    expect(prod.texto).toContain("`cargar-prod.sh registrar-escision`");
    expect(prod.texto).toContain(PARE);
    expect(local.texto).not.toContain(PARE);
    soloDelModo(prod, true);
  });

  it("1 SIN_LOTE_MADRE: el evento existe pero el origen no tiene lotes; dice construir los lotes", async () => {
    const [origen, destino] = [nemo("MO"), nemo("MD")];
    await origenSuelto(origen);
    expect(correr("registrar-escision.ts", eventoArgs(origen, destino, "--crear-destino")).codigo).toBe(0);
    const s = correr("lote-escision.ts", loteArgs(destino));
    comprobar(s, 1, "❌ No se registró: SIN_LOTE_MADRE · la especie origen no tiene un lote vivo en la fecha del evento", [origen, destino, FECHA, "4613", "1237"]);
    expect(s.texto).toContain("`npm run lotes:construir`");
    expect(await db.lote.count({ where: { instrumento: { nemotecnico: destino } } })).toBe(0);
  });

  it("0 en local con el id del lote y el siguiente paso; al repetirlo, 1 LOTE_YA_REGISTRADO con su significado", async () => {
    const [origen, destino] = [nemo("LO"), nemo("LD")];
    await loteMadre(origen);
    expect(correr("registrar-escision.ts", eventoArgs(origen, destino, "--crear-destino")).codigo).toBe(0);
    const datos = [origen, destino, FECHA, "4613", "1237"];
    const s = correr("lote-escision.ts", loteArgs(destino));
    comprobar(s, 0, "➡️  Siguiente paso: registre los demás lotes de escisión", datos);
    const id = (await db.lote.findFirstOrThrow({ where: { instrumento: { nemotecnico: destino }, origen: "ESCISION" } })).id;
    expect(s.texto).toContain(`✅ Lote de escisión registrado (${id}).`);
    expect(s.texto).toContain("`npm run lotes:construir`");
    soloDelModo(s, false);
    comprobar(correr("lote-escision.ts", loteArgs(destino)), 1, "❌ No se registró: LOTE_YA_REGISTRADO · ese evento ya tiene su lote de escisión", datos);
  });

  it("0 en producción: el siguiente paso de la vía B, cargar-prod.sh construir-lotes", async () => {
    const [origen, destino] = [nemo("QO"), nemo("QD")];
    await loteMadre(origen);
    expect(correr("registrar-escision.ts", eventoArgs(origen, destino, "--crear-destino")).codigo).toBe(0);
    const s = correr("lote-escision.ts", loteArgs(destino), PROD);
    comprobar(s, 0, "➡️  Siguiente paso (vía B, §11 del runbook): registre los demás lotes de escisión", [origen, destino, FECHA, "4613", "1237"]);
    expect(s.texto).toContain("`cargar-prod.sh construir-lotes`");
    soloDelModo(s, true);
  });
});
