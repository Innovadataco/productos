// Salida y argumentos de la CLI de importación de la ficha (fase B, corte 2). La salida lleva solo
// conteos, líneas y códigos: nunca especies, cifras ni textos de la ficha. Datos inventados.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leerArgumentos } from "@/plan/importar/argumentos";
import { leerFicha } from "@/plan/importar/interpretar";
import { codigoDeSalida, formatearReporte } from "@/plan/importar/reporte";
import { resumenLectura, type ResultadoImportacion } from "@/plan/importar/resultado";

const FIXTURE = readFileSync(new URL("../../fixtures/ficha.ficticio.md", import.meta.url), "utf8");
const BASE: ResultadoImportacion = resumenLectura(leerFicha(FIXTURE), "ENSAYO");
/** Lo que nunca puede salir: especies, cifras, fechas y palabras de los textos del fixture. */
const PROHIBIDO = ["FICT", "120", "170", "246", "913", "1.357", "99999000123", "135", "791", "250", "1.111", "1111", "12,34", "0,37", "864", "2,222", "2025", "-mar", "$", "inventad", "ficticio "];

describe("resumenLectura", () => {
  it("cuenta lo leído de la ficha, sin tocar la base", () => {
    expect([BASE.modo, BASE.estado, BASE.versiones, BASE.reglas, BASE.decisiones]).toEqual([
      "ENSAYO",
      "LISTO",
      { leidas: 1, nuevas: 0, existentes: 0 },
      { leidas: 9, nuevas: 0, existentes: 0 },
      { leidas: 2, nuevas: 0, existentes: 0 },
    ]);
    expect([BASE.noImportados.length, BASE.avisos.length, BASE.bloqueos.length, BASE.error]).toEqual([14, 3, 0, null]);
  });

  it("con bloqueos de lectura queda BLOQUEADO", () => {
    expect(resumenLectura(leerFicha("# sin pie ni plan"), "ENSAYO").estado).toBe("BLOQUEADO");
  });
});

describe("formatearReporte", () => {
  const r: ResultadoImportacion = { ...BASE, versiones: { leidas: 1, nuevas: 1, existentes: 0 }, reglas: { leidas: 9, nuevas: 9, existentes: 0 }, decisiones: { leidas: 2, nuevas: 2, existentes: 0 } };
  const salida = formatearReporte(r, "ficha.ficticio.md");
  const texto = salida.join("\n");

  it("dice el modo, los conteos y el resultado", () => {
    expect(salida[0]).toBe("Ficha: ficha.ficticio.md · ENSAYO (no escribe nada)");
    expect(salida).toContain("Versiones: 1 leídas · 1 por crear · 0 ya en la base");
    expect(salida).toContain("Reglas: 9 leídas · 9 por crear · 0 ya en la base");
    expect(salida).toContain("Decisiones: 2 leídas · 2 por crear · 0 ya en la base");
    expect(salida).toContain("No importado: 14 · avisos: 3 · bloqueos: 0");
    expect(salida.at(-1)).toBe("Resultado: listo para --aplicar (no se escribió nada)");
  });

  it("agrupa por código con números de línea (línea.ítem cuando la línea se parte)", () => {
    expect(salida).toContain("  METADATOS · líneas 5, 6, 9");
    expect(salida).toContain("  CALENDARIO · líneas 18.1, 18.2, 18.3");
    expect(salida).toContain("  PLAZO_EN_TEXTO · línea 24");
  });

  it("lista aparte las líneas pendientes de enlazar (operaciones ejecutadas y excepciones)", () => {
    expect(salida).toContain("Pendientes de enlazar (corte siguiente, con el dueño): líneas 13, 26.2");
  });

  it("no imprime ningún valor de la ficha", () => {
    for (const p of PROHIBIDO) expect(texto, p).not.toContain(p);
  });

  it("en modo aplicar habla de creadas", () => {
    expect(formatearReporte({ ...r, modo: "APLICAR", estado: "APLICADO" }, "f.md")).toContain("Reglas: 9 leídas · 9 creadas · 0 ya en la base");
  });

  it("el candado ocupado se dice claro", () => {
    expect(formatearReporte({ ...r, modo: "APLICAR", estado: "CANDADO_OCUPADO" }, "f.md").at(-1)).toBe("Resultado: otra importación en curso; no se escribió nada");
  });

  it("el conflicto de versión explica que una ficha nueva trae fecha nueva", () => {
    const conflicto = formatearReporte({ ...r, estado: "BLOQUEADO", bloqueos: [{ linea: 20, item: null, codigo: "VERSION_EN_CONFLICTO" }] }, "f.md").join("\n");
    expect(conflicto).toContain("VERSION_EN_CONFLICTO · línea 20");
    expect(conflicto).toContain("una ficha nueva debe traer una fecha nueva");
  });

  it("un bloqueo de validación muestra el campo, nunca el valor", () => {
    const s = formatearReporte({ ...r, estado: "BLOQUEADO", bloqueos: [{ linea: 24, item: null, codigo: "DEMASIADO_LARGO", campo: "motivo" }] }, "f.md");
    expect(s).toContain("  DEMASIADO_LARGO (motivo) · línea 24");
  });

  it("un error interno a mitad muestra su clase, nunca su mensaje", () => {
    const s = formatearReporte({ ...r, modo: "APLICAR", estado: "FALLO_PARCIAL", error: { linea: 24, item: null, codigo: "ERROR_INTERNO", nombre: "FallaRara" } }, "f.md");
    expect(s.at(-1)).toBe("Resultado: falló en la línea 24 (ERROR_INTERNO: FallaRara); repita el comando para completar lo que falta");
  });

  it("si el candado no se soltó limpio, lo avisa", () => {
    const s = formatearReporte({ ...r, modo: "APLICAR", estado: "APLICADO", avisos: [{ linea: 0, item: null, codigo: "CANDADO_NO_SOLTADO" }] }, "f.md").join("\n");
    expect(s).toContain("CANDADO_NO_SOLTADO · toda la ficha");
  });

  it("un fallo a mitad dice dónde y cómo seguir", () => {
    const s = formatearReporte({ ...r, modo: "APLICAR", estado: "FALLO_PARCIAL", error: { linea: 24, item: null, codigo: "SIN_PLAN" } }, "f.md");
    expect(s.at(-1)).toBe("Resultado: falló en la línea 24 (SIN_PLAN); repita el comando para completar lo que falta");
  });
});

describe("codigoDeSalida", () => {
  it.each([
    ["LISTO", 0],
    ["SIN_CAMBIOS", 0],
    ["APLICADO", 0],
    ["BLOQUEADO", 1],
    ["FALLO_PARCIAL", 1],
    ["CANDADO_OCUPADO", 3],
  ] as const)("%s → %s", (estado, codigo) => {
    expect(codigoDeSalida({ ...BASE, estado })).toBe(codigo);
  });
});

describe("leerArgumentos", () => {
  it("por defecto es ensayo", () => {
    expect(leerArgumentos(["--ficha", "f.md", "--email", "a@b.invalid"])).toEqual({ ok: true, ficha: "f.md", email: "a@b.invalid", aplicar: false });
  });

  it("--aplicar en cualquier posición", () => {
    expect(leerArgumentos(["--aplicar", "--email", "a@b.invalid", "--ficha", "f.md"])).toEqual({ ok: true, ficha: "f.md", email: "a@b.invalid", aplicar: true });
  });

  it.each([
    [[]],
    [["--ficha", "f.md"]],
    [["--email", "a@b.invalid"]],
    [["--ficha", "--email", "a@b.invalid"]],
    [["--ficha", "f.md", "--email", "a@b.invalid", "--otro"]],
    [["--ficha", "f.md", "--ficha", "g.md", "--email", "a@b.invalid"]],
    [["--ficha", "f.md", "--email", "a@b.invalid", "suelto"]],
    [["--ficha", "f.md", "--email", ""]],
  ])("rechaza %j con USO", (argv) => {
    expect(leerArgumentos(argv)).toEqual({ ok: false, codigo: "USO" });
  });
});
