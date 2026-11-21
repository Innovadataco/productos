/**
 * Tabla de la certificación de A&V: de las líneas del PDF a filas por sección, sin interpretar valores
 * (eso lo hace el importador). Secciones: FONDOS DE INVERSIÓN, RENTA VARIABLE y SALDO EN EFECTIVO, cada
 * una con su título y su encabezado de columnas. Una sección sigue en la página siguiente hasta el próximo
 * título. El pie de cada página (desde «Defensor del Consumidor Financiero») se ignora.
 * Falla cerrado: una línea que no se entiende dentro de una sección, o un monto fuera de una sección,
 * rechaza el archivo entero. El error lleva página y línea, nunca el texto.
 */
import type { LecturaPdf, Linea } from "./pdf/lector";

export type Seccion = "FONDOS" | "RENTA_VARIABLE" | "EFECTIVO";

export type CodigoTabla =
  | "NO_ES_CERTIFICACION_AV"
  | "SECCION_REPETIDA"
  | "SECCION_FALTANTE"
  | "ENCABEZADO_DESCONOCIDO"
  | "FILA_INCOMPLETA"
  | "FILA_FUERA_DE_SECCION"
  | "SIN_FILAS";

export interface FilaTabla {
  readonly seccion: Seccion;
  readonly pagina: number;
  /** Ordinal de la fila de datos en el documento (1…N): el número de fila de la trazabilidad. */
  readonly numero: number;
  /** Las celdas en el orden de las columnas del encabezado. */
  readonly celdas: readonly string[];
}

export class ErrorTabla extends Error {
  /** `pagina` y `linea` (1…) ubican la línea; 0 y 0 si el problema es del documento entero. */
  constructor(readonly codigo: CodigoTabla, readonly pagina = 0, readonly linea = 0) {
    super(`La certificación no tiene la estructura esperada (${codigo}${pagina > 0 ? `, página ${pagina}, línea ${linea}` : ""}).`);
    this.name = "ErrorTabla";
  }
}

interface DefinicionSeccion {
  readonly titulo: string;
  readonly columnas: readonly string[];
}

export const SECCIONES: Readonly<Record<Seccion, DefinicionSeccion>> = {
  FONDOS: { titulo: "FONDOS DE INVERSIÓN", columnas: ["DESCRIPCIÓN", "NIT DEL FONDO", "ENCARGO", "SALDO"] },
  RENTA_VARIABLE: { titulo: "RENTA VARIABLE", columnas: ["NEMOTÉCNICO", "CANTIDAD", "PRECIO VALORACIÓN", "VALOR DE MERCADO"] },
  EFECTIVO: { titulo: "SALDO EN EFECTIVO", columnas: ["NOMBRE", "CUENTA", "SALDO"] },
};

const MARCA_PIE = "DEFENSOR DEL CONSUMIDOR FINANCIERO";
const MARCA_AV = "ACCIONES & VALORES";
/** Un monto en pesos, en el formato del portal («COP 1.000,00») o con signo de pesos. */
const MONTO = /\bCOP\s*-?\d|\$\s*-?\d/;

/** Mayúsculas, sin tildes y con un solo espacio: «Precio  valoración» = «PRECIO VALORACION». */
const normalizar = (t: string): string => t.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();

const POR_TITULO = new Map((Object.keys(SECCIONES) as Seccion[]).map((s) => [normalizar(SECCIONES[s].titulo), s] as const));

const textos = (l: Linea): string[] => l.celdas.map((c) => c.texto);
const esEncabezado = (l: Linea, s: Seccion): boolean => {
  const columnas = SECCIONES[s].columnas;
  return l.celdas.length === columnas.length && l.celdas.every((c, i) => normalizar(c.texto) === normalizar(columnas[i]!));
};
const tituloDe = (l: Linea): Seccion | undefined => (l.celdas.length === 1 ? POR_TITULO.get(normalizar(l.celdas[0]!.texto)) : undefined);
const tieneMonto = (l: Linea): boolean => l.celdas.some((c) => MONTO.test(c.texto));

interface Estado {
  seccion: Seccion | null;
  /** Página donde se abrió (o se retomó) la sección actual: su título solo se repite en otra página. */
  paginaSeccion: number;
  esperaEncabezado: { pagina: number; linea: number } | null;
  enPie: boolean;
  readonly vistas: Set<Seccion>;
  readonly filas: FilaTabla[];
}

function abrirSeccion(e: Estado, s: Seccion, pagina: number, linea: number): void {
  const retomada = e.seccion === s && pagina !== e.paginaSeccion;
  if (e.vistas.has(s) && !retomada) throw new ErrorTabla("SECCION_REPETIDA", pagina, linea);
  e.seccion = s;
  e.paginaSeccion = pagina;
  e.vistas.add(s);
  e.esperaEncabezado = { pagina, linea };
}

function procesarLinea(e: Estado, l: Linea, linea: number): void {
  if (e.enPie) {
    // El pie es texto corrido de una celda por línea: una línea con columnas o con un monto sería una fila escondida.
    if (l.celdas.length > 1 || tieneMonto(l)) throw new ErrorTabla("FILA_FUERA_DE_SECCION", l.pagina, linea);
    return;
  }
  if (normalizar(textos(l)[0] ?? "").startsWith(MARCA_PIE)) {
    e.enPie = true;
    return;
  }
  const titulo = tituloDe(l);
  if (titulo) return abrirSeccion(e, titulo, l.pagina, linea);
  if (e.seccion === null) {
    if (tieneMonto(l)) throw new ErrorTabla("FILA_FUERA_DE_SECCION", l.pagina, linea);
    return;
  }
  if (e.esperaEncabezado) {
    if (!esEncabezado(l, e.seccion)) throw new ErrorTabla("ENCABEZADO_DESCONOCIDO", l.pagina, linea);
    e.esperaEncabezado = null;
    return;
  }
  if (esEncabezado(l, e.seccion)) return; // encabezado repetido al seguir en otra página
  if (l.celdas.length !== SECCIONES[e.seccion].columnas.length) throw new ErrorTabla("FILA_INCOMPLETA", l.pagina, linea);
  e.filas.push({ seccion: e.seccion, pagina: l.pagina, numero: e.filas.length + 1, celdas: textos(l) });
}

export function leerTablaCertificacion(lectura: LecturaPdf): FilaTabla[] {
  if (!lectura.lineas.some((l) => l.celdas.some((c) => normalizar(c.texto).includes(MARCA_AV)))) throw new ErrorTabla("NO_ES_CERTIFICACION_AV");
  const e: Estado = { seccion: null, paginaSeccion: 0, esperaEncabezado: null, enPie: false, vistas: new Set(), filas: [] };
  let pagina = 0;
  let linea = 0;
  for (const l of lectura.lineas) {
    // Un título al pie de una página puede tener su encabezado en la siguiente: solo se exige al final.
    if (l.pagina !== pagina) [pagina, linea, e.enPie] = [l.pagina, 0, false];
    linea += 1;
    procesarLinea(e, l, linea);
  }
  if (e.esperaEncabezado) throw new ErrorTabla("ENCABEZADO_DESCONOCIDO", e.esperaEncabezado.pagina, e.esperaEncabezado.linea);
  if (!e.vistas.has("EFECTIVO")) throw new ErrorTabla("SECCION_FALTANTE");
  // Sin acciones ni fondos vigentes, el portal igual pinta la sección vacía; si no aparece ninguna, cambió el formato.
  if (!e.vistas.has("FONDOS") && !e.vistas.has("RENTA_VARIABLE")) throw new ErrorTabla("SIN_FILAS");
  return e.filas;
}
