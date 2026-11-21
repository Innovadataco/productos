/**
 * Lector de bloques del markdown de la ficha, por línea (cada bloque lleva su número de línea, para
 * reportar sin imprimir valores). Solo lo que la ficha usa: títulos, tablas GFM, viñetas, citas,
 * separadores y párrafos de una línea. No hay dependencia de markdown en el proyecto.
 */
export interface FilaTabla {
  readonly linea: number;
  readonly celdas: readonly string[];
}

export type Bloque =
  | { readonly tipo: "titulo"; readonly linea: number; readonly nivel: number; readonly texto: string }
  | { readonly tipo: "tabla"; readonly linea: number; readonly lineaSeparador: number; readonly encabezado: readonly string[]; readonly filas: readonly FilaTabla[] }
  | { readonly tipo: "vineta"; readonly linea: number; readonly texto: string }
  | { readonly tipo: "cita"; readonly linea: number; readonly texto: string }
  | { readonly tipo: "separador"; readonly linea: number }
  | { readonly tipo: "parrafo"; readonly linea: number; readonly texto: string };

const TITULO = /^(#{1,6})\s+(.*)$/;
const VINETA = /^\s*[-*+]\s+(.*)$/;
const CITA = /^>\s?(.*)$/;
const SEPARADOR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const SEPARADOR_TABLA = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** BOM fuera, CRLF → LF, espacios sin separación (U+00A0, U+202F, U+2007) → espacio, y NFC. */
export function normalizarTexto(contenido: string): string {
  return contenido.replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/[   ]/g, " ").normalize("NFC");
}

/** Celdas de una fila de tabla; `\|` es una barra dentro de la celda. */
export function partirCeldas(linea: string): string[] {
  const t = linea.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return t.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

/** Parte en `separador` solo fuera de paréntesis: «a · b (c · d)» → «a», «b (c · d)». */
export function partirNivelSuperior(texto: string, separador = " · "): string[] {
  const partes: string[] = [];
  let profundidad = 0;
  let inicio = 0;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (c === "(") profundidad += 1;
    else if (c === ")") profundidad = Math.max(0, profundidad - 1);
    else if (profundidad === 0 && texto.startsWith(separador, i)) {
      partes.push(texto.slice(inicio, i));
      inicio = i + separador.length;
      i = inicio - 1;
    }
  }
  partes.push(texto.slice(inicio));
  return partes.map((p) => p.trim()).filter((p) => p !== "");
}

/** Sin marcas de negrita (`**`, `__`) y recortado. */
export function textoPlano(texto: string): string {
  return texto.replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim();
}

function esFilaDeTabla(linea: string | undefined): boolean {
  return linea !== undefined && linea.trimStart().startsWith("|");
}

function leerTabla(lineas: readonly string[], i: number): { bloque: Bloque; siguiente: number } {
  const filas: FilaTabla[] = [];
  let j = i + 2;
  while (j < lineas.length && esFilaDeTabla(lineas[j])) {
    filas.push({ linea: j + 1, celdas: partirCeldas(lineas[j]!) });
    j += 1;
  }
  return { bloque: { tipo: "tabla", linea: i + 1, lineaSeparador: i + 2, encabezado: partirCeldas(lineas[i]!), filas }, siguiente: j };
}

function leerLinea(texto: string, numero: number): Bloque {
  const titulo = TITULO.exec(texto);
  if (titulo) return { tipo: "titulo", linea: numero, nivel: titulo[1]!.length, texto: titulo[2]!.trim() };
  if (SEPARADOR.test(texto)) return { tipo: "separador", linea: numero };
  const vineta = VINETA.exec(texto);
  if (vineta) return { tipo: "vineta", linea: numero, texto: vineta[1]!.trim() };
  const cita = CITA.exec(texto);
  if (cita) return { tipo: "cita", linea: numero, texto: cita[1]!.trim() };
  return { tipo: "parrafo", linea: numero, texto: texto.trim() };
}

export function leerBloques(contenido: string): readonly Bloque[] {
  const lineas = normalizarTexto(contenido).split("\n");
  const bloques: Bloque[] = [];
  let i = 0;
  while (i < lineas.length) {
    const texto = lineas[i]!;
    if (texto.trim() === "") {
      i += 1;
    } else if (esFilaDeTabla(texto) && SEPARADOR_TABLA.test(lineas[i + 1] ?? "")) {
      const { bloque, siguiente } = leerTabla(lineas, i);
      bloques.push(bloque);
      i = siguiente;
    } else {
      bloques.push(leerLinea(texto, i + 1));
      i += 1;
    }
  }
  return bloques;
}
