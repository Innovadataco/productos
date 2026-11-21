// Los CLI de 008 como proceso contra la base de PRUEBAS (hueco de pruebas): códigos de salida y que la
// consola NO lleve datos (correo, nemotécnicos, montos, fechas, notas, código o nombre del fondo, ruta del
// archivo). La base es compartida con los demás archivos y su orden no está garantizado: cada prueba crea
// sus propios datos (`FICT…` por corrida, correos @ejemplo.invalid) y solo afirma sobre ellos. El hijo
// recibe un entorno mínimo: la base de pruebas y las claves de cifrado de la corrida (vitest.integracion.config.ts).
// Fuera de aquí: actualizar-precios.ts y depurar-precios.ts (frente de precios), construir-lotes.ts (frente
// de lotes) y el modo «actualizar» de actualizar-fondo.ts (consulta datos.gov.co: nada de red en las pruebas).
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
const duenoEmail = `dueno-cli-${corrida.toLowerCase()}@ejemplo.invalid`;
const DIVIDENDOS = "Fecha y hora,Ticker,Estado,Valor total\n";
const ORDENES =
  "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
/** Hasta 6 CLI por prueba: cada uno arranca Node, tsx y Prisma. */
const POR_PRUEBA = { timeout: 6 * POR_CLI_MS };
let carpeta = "";

/** Las CIFRADO_CLAVE_* que fijó la config para esta corrida (las v2…v9 van vacías). */
const clavesDeLaCorrida = (): Record<string, string> =>
  Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith("CIFRADO_CLAVE_") && v !== undefined)) as Record<string, string>;

const correr = (script: string, args: readonly string[]): Salida =>
  correrCli(script, args, entornoMinimo({ DATABASE_URL: URL_BASE, ...clavesDeLaCorrida() }));

/** Sale con `codigo`, dice `esperado` y no imprime ninguno de los `datos` ni la URL de la base. */
const comprobar = (s: Salida, codigo: number, esperado: string, datos: readonly string[]): void =>
  comprobarSalida(s, codigo, esperado, [...datos, URL_BASE, "postgresql://"]);

function archivo(nombre: string, contenido: string | Buffer): string {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  carpeta = mkdtempSync(join(tmpdir(), "inv008-cli-"));
  await db.usuario.create({ data: { email: duenoEmail, rol: "DUENO" } });
});

afterAll(async () => {
  rmSync(carpeta, { recursive: true, force: true });
  await db.$disconnect();
});

describe("CLI importar-trii", POR_PRUEBA, () => {
  it("carga un CSV con 0 y lo repite con 0 sin duplicar: solo nombre del archivo y conteos", () => {
    const n = nemo("IT");
    const ruta = archivo("dividendos-cli.ficticio.csv", `${DIVIDENDOS}2026-01-21,${n},,4321.5\n2026-04-15,${n},,8765.25\n`);
    const datos = [duenoEmail, n, "4321.5", "8765.25", "2026-01-21", carpeta];
    const primera = correr("importar-trii.ts", ["--email", duenoEmail, ruta]);
    comprobar(primera, 0, "✅ dividendos-cli.ficticio.csv · TRII_DIVIDENDOS · 2 filas: 2 nuevas, 0 repetidas, 1 instrumentos nuevos", datos);
    comprobar(correr("importar-trii.ts", ["--email", duenoEmail, ruta]), 0, "2 filas: 0 nuevas, 2 repetidas, 0 instrumentos nuevos", datos);
  });

  it("un archivo rechazado sale con 1, con fila y código pero sin las celdas, y no frena a los demás", async () => {
    const n = nemo("IR");
    const bueno = archivo("bueno-cli.ficticio.csv", `${DIVIDENDOS}2026-02-09,${n},,55.5\n`);
    const malo = archivo("ajeno-cli.ficticio.csv", "Columna secreta,Otra\nvalor-secreto-cli,99887766\n");
    const s = correr("importar-trii.ts", ["--email", duenoEmail, malo, bueno]);
    const datos = [duenoEmail, n, "Columna secreta", "valor-secreto-cli", "99887766", "55.5", carpeta];
    comprobar(s, 1, "❌ ajeno-cli.ficticio.csv · RECHAZADO (nada se guardó) · 1 error(es):", datos);
    expect(s.texto).toContain("fila 1 · ENCABEZADO_DESCONOCIDO");
    expect(s.texto).toContain("✅ bueno-cli.ficticio.csv · TRII_DIVIDENDOS · 1 filas: 1 nuevas");
    expect(await db.dividendo.count({ where: { instrumento: { nemotecnico: n } } })).toBe(1);
  });

  it("un archivo de más de 5 MB no se lee: sale con 1 y no se registra ninguna carga con su nombre", async () => {
    const nombreGrande = `grande-cli-${corrida}.ficticio.csv`;
    const grande = archivo(nombreGrande, Buffer.alloc(5 * 1024 * 1024 + 1, 0x41));
    comprobar(correr("importar-trii.ts", ["--email", duenoEmail, grande]), 1, `❌ ${nombreGrande}: pasa de 5 MB, no se importa.`, [duenoEmail, carpeta]);
    expect(await db.cargaArchivo.count({ where: { nombreArchivo: nombreGrande } })).toBe(0);
  });

  it("un correo que no está registrado sale con 2 sin repetirlo y sin crear la cuenta", async () => {
    const otro = `no-registrado-${corrida.toLowerCase()}@ejemplo.invalid`;
    const ruta = archivo("nadie-cli.ficticio.csv", `${DIVIDENDOS}2026-03-01,${nemo("NR")},,1.0\n`);
    comprobar(correr("importar-trii.ts", ["--email", otro, ruta]), 2, "Ese correo no está registrado", [otro]);
    expect(await db.usuario.count({ where: { email: otro } })).toBe(0);
  });

  it("--crear-dueno con un dueño ya registrado sale con 2 y no crea otro", async () => {
    // El dueño de beforeAll garantiza que ya hay uno, sea cual sea el orden de los archivos.
    const otro = `segundo-dueno-${corrida.toLowerCase()}@ejemplo.invalid`;
    const ruta = archivo("segundo-cli.ficticio.csv", `${DIVIDENDOS}2026-03-02,${nemo("SD")},,1.0\n`);
    comprobar(correr("importar-trii.ts", ["--email", otro, "--crear-dueno", ruta]), 2, "Ya hay un dueño registrado con otro correo", [otro]);
    expect(await db.usuario.count({ where: { email: otro } })).toBe(0);
  });
});

describe("CLI registrar-escision y lote-escision", POR_PRUEBA, () => {
  const fecha = "2024-02-26";
  const loteArgs = (destino: string) => ["--destino", destino, "--fecha-evento", fecha, "--cantidad", "79193", "--costo-unitario", "4321.5"];

  /** La compra de la especie origen y su lote, armados a mano (sin pasar por construir-lotes). */
  async function loteMadre(origen: string): Promise<void> {
    const ruta = archivo(`madre-${origen}.ficticio.csv`, `${ORDENES}"8 ene 2024, 10:00 a. m.",${origen},Compra,Aprobado,100,0,10.0,1000.0,7.0,1007.0\n`);
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

  it("registrar-escision: 0 al registrar (con --crear-destino) y 1 con solo el código al repetirlo; nunca imprime el evento", async () => {
    const [origen, destino] = [nemo("EO"), nemo("ED")];
    await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: origen, nombre: "Origen ficticio" } });
    const args = ["--origen", origen, "--destino", destino, "--fecha", fecha, "--razon", "0.7", "--nota", "nota ficticia del evento", "--crear-destino"];
    const datos = [origen, destino, fecha, "0.7", "nota ficticia"];
    comprobar(correr("registrar-escision.ts", args), 0, "✅ Evento de escisión registrado (", datos);
    comprobar(correr("registrar-escision.ts", args), 1, "❌ No se registró: EVENTO_DUPLICADO", datos);
    expect(await db.eventoCorporativo.count({ where: { origen: { nemotecnico: origen } } })).toBe(1);
  });

  it("registrar-escision con un origen que no existe: 1 «INSTRUMENTO_DESCONOCIDO», sin los nemotécnicos", () => {
    const [origen, destino] = [nemo("XO"), nemo("XD")];
    const s = correr("registrar-escision.ts", ["--origen", origen, "--destino", destino, "--fecha", fecha]);
    comprobar(s, 1, "❌ No se registró: INSTRUMENTO_DESCONOCIDO", [origen, destino]);
  });

  it("lote-escision sin evento registrado: 1 «EVENTO_NO_ENCONTRADO», sin los datos del lote", () => {
    const destino = nemo("SE");
    comprobar(correr("lote-escision.ts", loteArgs(destino)), 1, "❌ No se registró: EVENTO_NO_ENCONTRADO", [destino, fecha, "79193", "4321.5"]);
  });

  it("lote-escision con el evento y el lote madre: 0, y al repetirlo 1 «LOTE_YA_REGISTRADO»; nunca la cantidad ni el costo", async () => {
    const [origen, destino] = [nemo("LO"), nemo("LD")];
    await loteMadre(origen);
    expect(correr("registrar-escision.ts", ["--origen", origen, "--destino", destino, "--fecha", fecha, "--crear-destino"]).codigo).toBe(0);
    const datos = [origen, destino, fecha, "79193", "4321.5"];
    comprobar(correr("lote-escision.ts", loteArgs(destino)), 0, "✅ Lote de escisión registrado (", datos);
    comprobar(correr("lote-escision.ts", loteArgs(destino)), 1, "❌ No se registró: LOTE_YA_REGISTRADO", datos);
    expect(await db.lote.count({ where: { instrumento: { nemotecnico: destino }, origen: "ESCISION" } })).toBe(1);
  });
});

describe("CLI actualizar-fondo --registrar (sin red)", POR_PRUEBA, () => {
  it("registra con 0 («creado») y repite con 0 («ya existía»): imprime el id interno, nunca el código ni el nombre", async () => {
    const codigo = `8${String(Date.now()).slice(-8)}${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`;
    const nombre = "Fondo ficticio de la prueba de consola";
    const args = ["--registrar", "--codigo", codigo, "--nombre", nombre];
    const primero = correr("actualizar-fondo.ts", args);
    comprobar(primero, 0, "· creado · clase: no indicada", [codigo, nombre]);
    const id = (await db.instrumento.findFirstOrThrow({ where: { codigoFic: codigo } })).id;
    expect(primero.texto).toContain(`✅ Fondo ${id}`);
    comprobar(correr("actualizar-fondo.ts", args), 0, `✅ Fondo ${id} · ya existía`, [codigo, nombre]);
  });
});

describe("CLI cifrar-existentes", POR_PRUEBA, () => {
  /** El total y los «en claro» de fila_fuente que informa el ensayo. */
  function filaFuente(s: Salida): { total: number; enClaro: number } {
    const m = /fila_fuente: (\d+) filas · en claro (\d+)/.exec(s.texto);
    expect(m, s.texto).not.toBeNull();
    return { total: Number(m![1]), enClaro: Number(m![2]) };
  }

  it("--aplicar con un --base que no es la conectada sale con 1 «BASE_NO_COINCIDE» y no escribe", () => {
    const s = correr("cifrar-existentes.ts", ["--aplicar", "--base", "otra_base_test"]);
    comprobar(s, 1, "❌ La migración falló: ErrorMigracion (BASE_NO_COINCIDE)", []);
    expect(s.texto).not.toContain("cifradas ahora");
  });

  it("el ensayo no escribe (dos corridas iguales) y ve cifrada la fila que se acaba de importar", () => {
    const base = new URL(URL_BASE).pathname.slice(1);
    const antes = filaFuente(correr("cifrar-existentes.ts", []));
    const n = nemo("EN");
    const ruta = archivo("ensayo-cli.ficticio.csv", `${DIVIDENDOS}2026-05-05,${n},,6543.21\n`);
    expect(correr("importar-trii.ts", ["--email", duenoEmail, ruta]).codigo).toBe(0);

    const s = correr("cifrar-existentes.ts", []);
    expect(s.texto).toContain(`Base: ${base} · versión activa: v1 · modo: ENSAYO (no escribe)`);
    expect(filaFuente(s)).toEqual({ total: antes.total + 1, enClaro: antes.enClaro });
    expect(s.texto).not.toContain("Siguiente: corra el mismo comando otra vez");
    for (const d of [n, "6543.21", "2026-05-05", duenoEmail]) expect(s.texto, d).not.toContain(d);
    expect(correr("cifrar-existentes.ts", []).texto).toBe(s.texto);
    // Coherencia, no resultado: la base compartida puede traer alertas de otras pruebas (sin su clave,
    // anómalas). Con alertas sale 1 y lo avisa; sin ellas, 0.
    expect(s.codigo).toBe(s.texto.includes("⚠️  Hay valores anómalos") ? 1 : 0);
  });
});
