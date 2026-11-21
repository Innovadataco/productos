/**
 * El generador del PDF ficticio (tests/fixtures/av) imita la salida de jsPDF del portal de A&V. Si el
 * generador está mal, las pruebas del lector prueban contra un PDF que no existe: por eso se valida aquí
 * la estructura (xref, /Length, WinAnsi, Flate) y, en el Mac, que poppler (pdftotext) lo lea igual.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf } from "../../../fixtures/av/certificacion.ficticio";

const latin1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");

function entradasXref(texto: string): { numero: number; offset: number }[] {
  const inicio = texto.lastIndexOf("\nxref\n");
  const [, cabecera, ...resto] = texto.slice(inicio + 1).split("\n");
  const [primero, cuantos] = cabecera!.split(" ").map(Number);
  return resto.slice(0, cuantos!).flatMap((linea, i) => {
    const [offset, , tipo] = linea.split(" ");
    return tipo === "n" ? [{ numero: primero! + i, offset: Number(offset) }] : [];
  });
}

function streams(texto: string): { dic: string; datos: string }[] {
  const salida: { dic: string; datos: string }[] = [];
  const re = /<<((?:(?!<<)[^])*?)>>\nstream\n/g;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    const largo = Number(/\/Length (\d+)/.exec(m[1]!)![1]);
    const desde = m.index + m[0].length;
    salida.push({ dic: m[1]!, datos: texto.slice(desde, desde + largo) });
    expect(texto.slice(desde + largo, desde + largo + "\nendstream".length)).toBe("\nendstream");
  }
  return salida;
}

const tienePdftotext = (() => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("generador del PDF ficticio de la certificación", () => {
  const pdf = generarCertificacionPdf();
  const texto = latin1(pdf);

  it("empieza con la cabecera de PDF y termina con %%EOF", () => {
    expect(texto.startsWith("%PDF-1.3\n")).toBe(true);
    expect(texto.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("cada objeto en uso de la xref empieza exactamente en su offset", () => {
    const entradas = entradasXref(texto);
    expect(entradas.length).toBeGreaterThan(8);
    for (const e of entradas) expect(texto.slice(e.offset, e.offset + 20)).toMatch(new RegExp(`^${e.numero} 0 obj\\n`));
  });

  it("startxref apunta a la palabra xref", () => {
    const offset = Number(/startxref\n(\d+)\n%%EOF/.exec(texto)![1]);
    expect(texto.slice(offset, offset + 4)).toBe("xref");
  });

  it("el /Length de cada stream coincide con sus bytes (incluida la imagen binaria)", () => {
    const todos = streams(texto);
    expect(todos.some((s) => s.dic.includes("/Subtype /Image"))).toBe(true);
    expect(todos.filter((s) => !s.dic.includes("/Subtype") && s.datos.includes("BT")).length).toBe(2);
  });

  it("escribe en WinAnsi: Ó en un byte, la raya como 0x96 y los paréntesis escapados", () => {
    expect(texto).toContain("(FONDOS DE INVERSI\xd3N) Tj");
    expect(texto).toContain("\x96");
    expect(texto).toContain("\\(");
  });

  it("pinta el pie dos veces en cada página", () => {
    expect(texto.split("(Defensor del Consumidor Financiero").length - 1).toBe(4);
  });

  it("lleva la fecha de generación en /Info y ningún texto con forma de fecha en las páginas", () => {
    expect(texto).toMatch(/\/CreationDate \(D:\d{14}-05'00'\)/);
    const contenido = streams(texto).filter((s) => !s.dic.includes("/Subtype")).map((s) => s.datos).join("\n");
    expect(contenido).not.toMatch(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/);
  });

  it("con comprimir, los content streams van en FlateDecode y se inflan al mismo texto", () => {
    const comprimido = latin1(generarCertificacionPdf(CERTIFICACION_FICTICIA, { comprimir: true }));
    const paginas = streams(comprimido).filter((s) => s.dic.includes("/FlateDecode"));
    expect(paginas.length).toBe(2);
    const inflado = paginas.map((s) => inflateSync(Buffer.from(s.datos, "latin1")).toString("latin1")).join("\n");
    expect(inflado).toContain("(RENTA VARIABLE) Tj");
  });

  it("solo usa datos inventados (nemotécnicos FICT, fondo y titular ficticios)", () => {
    for (const f of CERTIFICACION_FICTICIA.rentaVariable) expect(f.nemo).toMatch(/^FICT\d$/);
    for (const f of CERTIFICACION_FICTICIA.fondos) expect(f.descripcion).toContain("FICTICIO");
    for (const f of CERTIFICACION_FICTICIA.efectivo) expect(f.nombre).toContain("Ficticio");
  });

  it.skipIf(!tienePdftotext)("poppler (pdftotext) lo lee: secciones, encabezados y montos en su lugar", () => {
    const dir = mkdtempSync(join(tmpdir(), "inv-av-"));
    try {
      const ruta = join(dir, "certificacion.ficticio.pdf");
      writeFileSync(ruta, pdf);
      const salida = execFileSync("pdftotext", ["-layout", ruta, "-"], { encoding: "utf8" });
      expect(salida).toContain("FONDOS DE INVERSIÓN");
      expect(salida).toMatch(/NEMOTÉCNICO\s+CANTIDAD\s+PRECIO VALORACIÓN\s+VALOR DE MERCADO/);
      expect(salida).toMatch(/FICT1\s+100\s+COP 1\.000,00\s+COP 100\.000,00/);
      expect(salida).toContain("SALDO EN EFECTIVO");
      expect(salida).toContain("Acciones & Valores S.A. – Teléfono");
      expect(existsSync(ruta)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
