// Lector de bloques de markdown de la ficha (fase B, corte 2). Textos inventados.
import { describe, expect, it } from "vitest";
import { leerBloques, normalizarTexto, partirCeldas, partirNivelSuperior, textoPlano } from "@/plan/importar/markdown";

describe("normalizarTexto", () => {
  it("quita el BOM, pasa CRLF a LF y los espacios sin separación a espacios normales", () => {
    expect(normalizarTexto("﻿a\r\nb c d")).toBe("a\nb c d");
  });

  it("compone los acentos (NFC) para que «Decisión» siempre se compare igual", () => {
    expect(normalizarTexto("Decisión")).toBe("Decisión");
  });
});

describe("leerBloques", () => {
  it("numera cada bloque con su línea (1 = primera) y salta las vacías", () => {
    const bloques = leerBloques("# Título\n\n## Sección\ntexto suelto\n- una viñeta\n* otra viñeta\n---\n> v1 · pie");
    expect(bloques).toEqual([
      { tipo: "titulo", linea: 1, nivel: 1, texto: "Título" },
      { tipo: "titulo", linea: 3, nivel: 2, texto: "Sección" },
      { tipo: "parrafo", linea: 4, texto: "texto suelto" },
      { tipo: "vineta", linea: 5, texto: "una viñeta" },
      { tipo: "vineta", linea: 6, texto: "otra viñeta" },
      { tipo: "separador", linea: 7 },
      { tipo: "cita", linea: 8, texto: "v1 · pie" },
    ]);
  });

  it("lee una tabla con encabezado, separador y filas, cada fila con su línea", () => {
    const [tabla] = leerBloques("| A | B |\n|---|:---:|\n| x | y |\n| z | w |\nfuera");
    expect(tabla).toEqual({
      tipo: "tabla",
      linea: 1,
      lineaSeparador: 2,
      encabezado: ["A", "B"],
      filas: [
        { linea: 3, celdas: ["x", "y"] },
        { linea: 4, celdas: ["z", "w"] },
      ],
    });
  });

  it("una tabla pegada a un párrafo (sin línea vacía) se reconoce igual", () => {
    const bloques = leerBloques("**Encabezado.**\n| A | B |\n|---|---|\n| x | y |");
    expect(bloques.map((b) => [b.tipo, b.linea])).toEqual([
      ["parrafo", 1],
      ["tabla", 2],
    ]);
  });

  it("una línea con barras sin separador debajo es un párrafo, no una tabla", () => {
    expect(leerBloques("| a | b |\notra")).toEqual([
      { tipo: "parrafo", linea: 1, texto: "| a | b |" },
      { tipo: "parrafo", linea: 2, texto: "otra" },
    ]);
  });
});

describe("partirCeldas", () => {
  it("respeta la barra escapada dentro de una celda", () => {
    expect(partirCeldas("| a | b \\| c |  d  |")).toEqual(["a", "b | c", "d"]);
  });

  it("acepta filas sin barras en los bordes", () => {
    expect(partirCeldas("a | b")).toEqual(["a", "b"]);
  });
});

describe("partirNivelSuperior", () => {
  it("parte en « · » sin romper lo que va entre paréntesis", () => {
    expect(partirNivelSuperior("uno · dos (a · b) · tres")).toEqual(["uno", "dos (a · b)", "tres"]);
  });

  it("un texto sin separador queda en una sola parte", () => {
    expect(partirNivelSuperior("solo")).toEqual(["solo"]);
  });
});

describe("textoPlano", () => {
  it("quita las marcas de negrita y recorta", () => {
    expect(textoPlano("  **Hola:** __mundo__  ")).toBe("Hola: mundo");
  });
});
