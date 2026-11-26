// El contador de peticiones del día del ciclo intradía (archivo de la huella) y los topes fijos.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ARCHIVO_CONTADOR_DIA, TOPE_ESPECIES_CICLO, TOPE_PETICIONES_DIA, contadorEnArchivo } from "@/precios/intradia/tope";
import { reporteCiclo } from "@/precios/intradia/reporte";

const dirs: string[] = [];
const carpeta = (): string => {
  const d = mkdtempSync(path.join(tmpdir(), "intradia-tope-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("los topes fijos", () => {
  it("20 especies por ciclo y 9 000 peticiones por día", () => {
    expect(TOPE_ESPECIES_CICLO).toBe(20);
    expect(TOPE_PETICIONES_DIA).toBe(9_000);
  });
});

describe("contadorEnArchivo", () => {
  it("sin carpeta de estado no hay contador", async () => {
    expect(await contadorEnArchivo(path.join(tmpdir(), "no-existe-intradia-ficticio"))).toBeNull();
  });

  it("guarda y lee el total del día; otro día empieza de cero", async () => {
    const dir = carpeta();
    const c = (await contadorEnArchivo(dir))!;
    expect(await c.leer("2027-02-09")).toBe(0);
    await c.guardar("2027-02-09", 41);
    expect(await c.leer("2027-02-09")).toBe(41);
    expect(await c.leer("2027-02-10")).toBe(0);
    expect(readFileSync(path.join(dir, ARCHIVO_CONTADOR_DIA), "utf8")).toBe("formato=1\ndia=2027-02-09\npeticiones=41\n");
  });

  it("un archivo que existe y no se puede interpretar cuenta como tope ALCANZADO (falla cerrada); otro día válido, 0", async () => {
    const dir = carpeta();
    const c = (await contadorEnArchivo(dir))!;
    for (const roto of ["dia=2027-02-09\npeticiones=abc\n", "", "basura sin igual", "peticiones=3\n", "dia=ayer\npeticiones=3\n", "dia=2027-02-09\npeticiones=-4\n", "dia=2027-02-09\npeticiones=1.5\n"]) {
      writeFileSync(path.join(dir, ARCHIVO_CONTADOR_DIA), roto);
      expect(await c.leer("2027-02-09"), JSON.stringify(roto)).toBe(Number.POSITIVE_INFINITY);
    }
    writeFileSync(path.join(dir, ARCHIVO_CONTADOR_DIA), "dia=2027-02-08\npeticiones=50\n");
    expect(await c.leer("2027-02-09")).toBe(0);
  });

  it("un error de lectura que no es «no existe» se propaga", async () => {
    const otra = carpeta();
    const d = (await contadorEnArchivo(otra))!;
    mkdirSync(path.join(otra, ARCHIVO_CONTADOR_DIA));
    await expect(d.leer("2027-02-09")).rejects.toThrow();
  });
});

describe("reporteCiclo · avisos y códigos nuevos", () => {
  const base = { especies: 0, peticiones: 0, barrasNuevas: 0, fallidas: [], sinCalendario: false };
  it("el tope diario (5) y los avisos salen en el reporte, con el código de salida", () => {
    const r = reporteCiclo({ ...base, codigo: 5, avisos: ["tope de peticiones por día (9000) alcanzado: hoy no se piden más precios"] });
    expect(r.codigoSalida).toBe(5);
    expect(r.lineas.join("\n")).toMatch(/tope de peticiones por día/);
    expect(r.lineas.join("\n")).toMatch(/Tope diario/);
  });

  it("sin barras en un año sin calendario (código 6) trae su aviso; el festivo normal (4), no", () => {
    const sin = reporteCiclo({ ...base, codigo: 6, peticiones: 2, especies: 2, sinCalendario: true, avisos: ["sin barras de hoy y sin calendario del año: posible día no hábil"] });
    expect(sin.codigoSalida).toBe(6);
    expect(sin.lineas.join("\n")).toMatch(/posible día no hábil/);
    expect(reporteCiclo({ ...base, codigo: 4, avisos: [] }).lineas).toHaveLength(1);
  });

  it("el fallo de datos (8) dice que no es un bloqueo", () => {
    const r = reporteCiclo({ ...base, codigo: 8, peticiones: 2, especies: 2, avisos: [] });
    expect(r.codigoSalida).toBe(8);
    expect(r.lineas.join("\n")).toMatch(/Fallo de datos/);
  });

  it("el bloqueo (7) dice «bloqueo (429/403/red)»", () => {
    expect(reporteCiclo({ ...base, codigo: 7, avisos: [] }).lineas.join("\n")).toContain("Bloqueo (429/403/red)");
  });
});
