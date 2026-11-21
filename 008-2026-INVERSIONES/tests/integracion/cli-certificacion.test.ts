// Los CLI de la certificación como proceso contra la base de PRUEBAS: códigos de salida, el siguiente paso de
// precios (no se llama a la red) y que la consola NO lleve datos (correo, especies, montos, NIT, encargo, ruta).
// Cada prueba crea sus propios datos; el hijo recibe un entorno mínimo (la base de pruebas y las claves de la
// corrida). Datos inventados.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POR_CLI_MS, comprobar as comprobarSalida, correr as correrCli, entornoMinimo, type Salida } from "../ayudas/cli";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const URL_BASE = process.env.DATABASE_URL ?? "";
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const email = `dueno-cli-cert-${corrida.toLowerCase()}@ejemplo.invalid`;
const nemos = ["A", "B", "C"].map((l) => `L${corrida}${l}`);
const NIT = "99700000-1";
const CODIGO_FIC = "5550001";
/** Un miércoles pasado de 2026 que no usan los otros archivos de certificación (el CLI usa el reloj real). */
const CORTE = "2026-09-02";
let carpeta = "";

const claves = (): Record<string, string> =>
  Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith("CIFRADO_CLAVE_") && v !== undefined)) as Record<string, string>;
const correr = (script: string, args: readonly string[]): Salida => correrCli(script, args, entornoMinimo({ DATABASE_URL: URL_BASE, ...claves() }));
const DATOS = [email, ...nemos, NIT, "000000001", CODIGO_FIC, "5.000.000", "5000000", "150000", "Titular"];
const comprobar = (s: Salida, codigo: number, esperado: string, mas: readonly string[] = []) => comprobarSalida(s, codigo, esperado, [...DATOS, ...mas, URL_BASE, "postgresql://"]);

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  carpeta = mkdtempSync(join(tmpdir(), "inv-cli-cert-"));
  await db.usuario.create({ data: { email, rol: "DUENO" } });
  await db.instrumento.create({ data: { tipo: "FIC", codigoFic: CODIGO_FIC, nombre: "Fondo ficticio" } });
});

afterAll(async () => {
  rmSync(carpeta, { recursive: true, force: true });
  await db.$disconnect();
});

describe("importar-certificacion y conciliar-certificacion contra la base", { timeout: 4 * POR_CLI_MS }, () => {
  it("importa, concilia e imprime el siguiente paso de precios con la fecha de corte; reimportar dice 0 filas nuevas", () => {
    const rv = CERTIFICACION_FICTICIA.rentaVariable;
    const espec = {
      ...CERTIFICACION_FICTICIA,
      fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit: NIT }],
      rentaVariable: rv.map((f, i) => ({ ...f, nemo: nemos[[0, 0, 1, 2][i]!]! })),
      creadoEn: "D:20260903101500-05'00'",
    };
    const ruta = join(carpeta, "cert.ficticio.pdf");
    writeFileSync(ruta, generarCertificacionPdf(espec));
    const args = ["--email", email, "--fecha-corte", CORTE, "--fondo", CODIGO_FIC, ruta];
    const primera = correr("importar-certificacion.ts", args);
    comprobar(primera, 0, "✅ CARGADO · 6 filas", [carpeta]);
    expect(primera.texto).toContain(`Conciliación al ${CORTE}: NO_CUADRA`);
    expect(primera.texto).toContain(`npm run precios:actualizar -- --desde ${CORTE}`);
    comprobar(correr("importar-certificacion.ts", args), 0, "0 filas nuevas", [carpeta]);
    comprobar(correr("conciliar-certificacion.ts", ["--fecha-corte", CORTE]), 0, `Conciliación al ${CORTE}`);
  });

  it("un PDF con una fila inválida: 1, RECHAZADO con página, fila, columna y código, sin valores", () => {
    const mala = { ...CERTIFICACION_FICTICIA, rentaVariable: [{ ...CERTIFICACION_FICTICIA.rentaVariable[0]!, nemo: nemos[0]!, valor: "COP 123.456,00" }], creadoEn: "D:20260903101500-05'00'" };
    const ruta = join(carpeta, "mala.ficticio.pdf");
    writeFileSync(ruta, generarCertificacionPdf(mala));
    comprobar(correr("importar-certificacion.ts", ["--email", email, "--fecha-corte", "2026-09-01", ruta]), 1, "página 1 · fila 2 · VALOR DE MERCADO · VALOR_INCOHERENTE", ["123.456", carpeta]);
  });

  it("un correo que no está registrado: 1, sin repetirlo y sin crear usuarios", () => {
    const ruta = join(carpeta, "cert.ficticio.pdf");
    const otro = `nadie-${corrida.toLowerCase()}@ejemplo.invalid`;
    comprobar(correr("importar-certificacion.ts", ["--email", otro, "--fecha-corte", CORTE, ruta]), 1, "USUARIO_NO_REGISTRADO", [otro]);
  });

  it("conciliar sin certificación de esa fecha: 1 con el código", () => {
    comprobar(correr("conciliar-certificacion.ts", ["--fecha-corte", "2026-10-28"]), 1, "SIN_CERTIFICACION");
  });
});
