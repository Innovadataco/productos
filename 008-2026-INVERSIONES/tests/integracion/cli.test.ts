// Los CLI de 008 como proceso contra la base de PRUEBAS (hueco de pruebas): códigos de salida y que la
// consola NO lleve datos (correo, nemotécnicos, montos, fechas, notas, código o nombre del fondo, ruta del
// archivo). La base es compartida con los demás archivos y su orden no está garantizado: cada prueba crea
// sus propios datos (`FICT…` por corrida, correos @ejemplo.invalid) y solo afirma sobre ellos.
// Fuera de aquí: actualizar-precios.ts (frente de precios), construir-lotes.ts (frente de lotes) y el modo
// «actualizar» de actualizar-fondo.ts (consulta datos.gov.co: nada de red en las pruebas).
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();
const URL_BASE = process.env.DATABASE_URL ?? "";
const TSX = join("node_modules", ".bin", "tsx");
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const nemo = (base: string) => `FICT${base}${corrida}`.replace(/[^A-Z0-9]/g, "").slice(0, 20);
const duenoEmail = `dueno-cli-${corrida.toLowerCase()}@ejemplo.invalid`;
const DIVIDENDOS = "Fecha y hora,Ticker,Estado,Valor total\n";
let carpeta = "";
let duenoId = "";

interface Salida {
  readonly codigo: number | null;
  readonly texto: string;
}

function correr(script: string, args: readonly string[]): Salida {
  const r = spawnSync(TSX, [join("scripts", script), ...args], { env: { ...process.env, DATABASE_URL: URL_BASE }, encoding: "utf8", timeout: 60_000 });
  return { codigo: r.status, texto: `${r.stdout}${r.stderr}` };
}

/** Sale con `codigo`, dice `esperado` y no imprime ninguno de los `datos` ni la URL de la base. */
function comprobar(s: Salida, codigo: number, esperado: string, datos: readonly string[]): void {
  expect(s.codigo, s.texto).toBe(codigo);
  expect(s.texto).toContain(esperado);
  for (const d of [...datos, URL_BASE, "postgresql://"]) expect(s.texto, d).not.toContain(d);
}

function archivo(nombre: string, contenido: string | Buffer): string {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  carpeta = mkdtempSync(join(tmpdir(), "inv008-cli-"));
  duenoId = (await db.usuario.create({ data: { email: duenoEmail, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("CLI importar-trii", () => {
  it("carga un CSV con 0 y lo repite con 0 sin duplicar: solo nombre del archivo y conteos", () => {
    const n = nemo("IT");
    const ruta = archivo("dividendos-cli.ficticio.csv", `${DIVIDENDOS}2026-01-21,${n},,4321.5\n2026-04-15,${n},,8765.25\n`);
    const datos = [duenoEmail, n, "4321.5", "8765.25", "2026-01-21", carpeta];
    comprobar(correr("importar-trii.ts", ["--email", duenoEmail, ruta]), 0, "✅ dividendos-cli.ficticio.csv · TRII_DIVIDENDOS · 2 filas: 2 nuevas, 0 repetidas, 1 instrumentos nuevos", datos);
    comprobar(correr("importar-trii.ts", ["--email", duenoEmail, ruta]), 0, "2 filas: 0 nuevas, 2 repetidas, 0 instrumentos nuevos", datos);
  });

  it("un archivo rechazado sale con 1, con fila y código pero sin las celdas, y no frena a los demás", async () => {
    const n = nemo("IR");
    const bueno = archivo("bueno-cli.ficticio.csv", `${DIVIDENDOS}2026-02-09,${n},,55.5\n`);
    const malo = archivo("ajeno-cli.ficticio.csv", "Columna secreta,Otra\nvalor-secreto-cli,99887766\n");
    const s = correr("importar-trii.ts", ["--email", duenoEmail, malo, bueno]);
    comprobar(s, 1, "❌ ajeno-cli.ficticio.csv · RECHAZADO (nada se guardó) · 1 error(es):", [duenoEmail, n, "Columna secreta", "valor-secreto-cli", "99887766", "55.5", carpeta]);
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
    const otro = `segundo-dueno-${corrida.toLowerCase()}@ejemplo.invalid`;
    const ruta = archivo("segundo-cli.ficticio.csv", `${DIVIDENDOS}2026-03-02,${nemo("SD")},,1.0\n`);
    comprobar(correr("importar-trii.ts", ["--email", otro, "--crear-dueno", ruta]), 2, "Ya hay un dueño registrado con otro correo", [otro]);
    expect(await db.usuario.count({ where: { email: otro } })).toBe(0);
  });
});

describe("CLI registrar-escision y lote-escision", () => {
  const fecha = "2024-02-26";

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
    comprobar(correr("registrar-escision.ts", ["--origen", origen, "--destino", destino, "--fecha", fecha]), 1, "❌ No se registró: INSTRUMENTO_DESCONOCIDO", [origen, destino]);
  });

  it("lote-escision: 1 «EVENTO_NO_ENCONTRADO» sin evento; 0 con el evento y el lote madre; sin imprimir cantidad ni costo", async () => {
    const [origen, destino] = [nemo("LO"), nemo("LD")];
    const lote = ["--destino", destino, "--fecha-evento", fecha, "--cantidad", "79193", "--costo-unitario", "4321.5"];
    const datos = [origen, destino, fecha, "79193", "4321.5"];
    comprobar(correr("lote-escision.ts", lote), 1, "❌ No se registró: EVENTO_NO_ENCONTRADO", datos);

    // El lote madre se arma a mano (compra importada + su lote), sin pasar por construir-lotes.
    const ruta = archivo(
      "madre-cli.ficticio.csv",
      "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n" +
        `"8 ene 2024, 10:00 a. m.",${origen},Compra,Aprobado,100,0,10.0,1000.0,7.0,1007.0\n`,
    );
    expect(correr("importar-trii.ts", ["--email", duenoEmail, ruta]).codigo).toBe(0);
    const compra = await db.orden.findFirstOrThrow({ where: { instrumento: { nemotecnico: origen } } });
    await db.lote.create({
      data: {
        instrumentoId: compra.instrumentoId, origen: "COMPRA", ordenId: compra.id, fechaCompra: compra.fechaOperacion, fechaLiquidacion: compra.fechaLiquidacion,
        cantidad: compra.cantidadCompletada, costoUnitario: compra.precioUnitario, costoTotal: compra.totalInvertido, comision: compra.comision, fuenteCosto: "TRII_ORDEN",
      },
    });
    expect(correr("registrar-escision.ts", ["--origen", origen, "--destino", destino, "--fecha", fecha, "--crear-destino"]).codigo).toBe(0);

    comprobar(correr("lote-escision.ts", lote), 0, "✅ Lote de escisión registrado (", datos);
    comprobar(correr("lote-escision.ts", lote), 1, "❌ No se registró: LOTE_YA_REGISTRADO", datos);
    expect(await db.lote.count({ where: { instrumento: { nemotecnico: destino }, origen: "ESCISION" } })).toBe(1);
  });
});

describe("CLI actualizar-fondo --registrar (sin red)", () => {
  it("registra con 0 («creado») y repite con 0 («ya existía»): imprime el id interno, nunca el código ni el nombre", async () => {
    const codigo = `8${String(Date.now()).slice(-9)}`;
    const nombre = "Fondo ficticio de la prueba de consola";
    const args = ["--registrar", "--codigo", codigo, "--nombre", nombre];
    const primero = correr("actualizar-fondo.ts", args);
    comprobar(primero, 0, "· creado · clase: no indicada", [codigo, nombre]);
    const id = (await db.instrumento.findFirstOrThrow({ where: { codigoFic: codigo } })).id;
    expect(primero.texto).toContain(`✅ Fondo ${id}`);
    comprobar(correr("actualizar-fondo.ts", args), 0, `✅ Fondo ${id} · ya existía`, [codigo, nombre]);
  });
});

describe("CLI cifrar-existentes", () => {
  it("--aplicar con un --base que no es la conectada sale con 1 «BASE_NO_COINCIDE» y no escribe", () => {
    const s = correr("cifrar-existentes.ts", ["--aplicar", "--base", "otra_base_test"]);
    comprobar(s, 1, "❌ La migración falló: ErrorMigracion (BASE_NO_COINCIDE)", []);
    expect(s.texto).not.toContain("cifradas ahora");
  });

  it("el ensayo solo cuenta: nombra la base, no imprime crudos, y su salida concuerda con su aviso", () => {
    const n = nemo("EN");
    const ruta = archivo("ensayo-cli.ficticio.csv", `${DIVIDENDOS}2026-05-05,${n},,6543.21\n`);
    expect(correr("importar-trii.ts", ["--email", duenoEmail, ruta]).codigo).toBe(0);
    const base = new URL(URL_BASE).pathname.slice(1);
    const s = correr("cifrar-existentes.ts", []);
    expect(s.texto).toContain(`Base: ${base} · versión activa: v1 · modo: ENSAYO (no escribe)`);
    expect(s.texto).toMatch(/fila_fuente: \d+ filas · en claro \d+/);
    expect(s.texto).not.toContain("Siguiente: corra el mismo comando otra vez");
    for (const d of [n, "6543.21", "2026-05-05", duenoEmail]) expect(s.texto, d).not.toContain(d);
    // Las alertas (anómalas o sin su clave que dejan otras pruebas en la base compartida) dan 1; sin ellas, 0.
    expect(s.codigo).toBe(s.texto.includes("⚠️  Hay valores anómalos") ? 1 : 0);
  });
});
