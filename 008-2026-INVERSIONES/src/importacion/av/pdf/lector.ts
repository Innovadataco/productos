/**
 * Lector de la certificación de A&V: PDF → líneas de texto con sus celdas (de arriba abajo y de izquierda
 * a derecha). Es la interfaz estable del lector: si un día se cambia por pdfjs, se cambia detrás de esta.
 * Lo pintado dos veces en el mismo lugar con el mismo texto (el pie del portal) cuenta una sola vez.
 */
import { abrirDocumento } from "./documento";
import { ErrorPdf } from "./errores";
import { extraerCeldas, type CeldaPdf } from "./texto";

/** Celdas a menos de esta distancia vertical (puntos) son de la misma línea. */
export const TOLERANCIA_Y = 2;

export interface CeldaLinea {
  readonly x: number;
  readonly texto: string;
}

export interface Linea {
  readonly pagina: number;
  readonly y: number;
  readonly celdas: readonly CeldaLinea[];
}

export interface LecturaPdf {
  readonly lineas: readonly Linea[];
  readonly paginas: number;
  /** /Info /CreationDate (la fecha en que el portal generó el PDF), o null. */
  readonly creadoEn: Date | null;
}

function sinRepetidos(celdas: readonly CeldaPdf[]): CeldaPdf[] {
  const vistas = new Set<string>();
  return celdas.filter((c) => {
    const clave = `${c.pagina}|${c.x}|${c.y}|${c.texto}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

const enOrden = (a: CeldaPdf, b: CeldaPdf) => a.pagina - b.pagina || b.y - a.y || a.x - b.x;

/** Agrupa por página y por y (con tolerancia), ordena y quita espacios de los extremos y celdas vacías. */
export function agruparLineas(celdas: readonly CeldaPdf[]): Linea[] {
  const utiles = sinRepetidos(celdas.map((c) => ({ ...c, texto: c.texto.trim() })).filter((c) => c.texto.length > 0)).sort(enOrden);
  if (utiles.length === 0) throw new ErrorPdf("PDF_SIN_TEXTO");
  const lineas: { pagina: number; y: number; celdas: CeldaPdf[] }[] = [];
  for (const c of utiles) {
    const actual = lineas[lineas.length - 1];
    if (actual && actual.pagina === c.pagina && Math.abs(actual.y - c.y) <= TOLERANCIA_Y) actual.celdas.push(c);
    else lineas.push({ pagina: c.pagina, y: c.y, celdas: [c] });
  }
  return lineas.map((l) => ({ pagina: l.pagina, y: l.y, celdas: [...l.celdas].sort((a, b) => a.x - b.x).map(({ x, texto }) => ({ x, texto })) }));
}

/** Cualquier error que no sea del lector sale como PDF_ERROR_INTERNO: el mensaje nunca lleva la causa. */
export function extraerLineas(bytes: Uint8Array): LecturaPdf {
  try {
    const doc = abrirDocumento(bytes);
    return { lineas: agruparLineas(extraerCeldas(doc)), paginas: doc.paginas.length, creadoEn: doc.creadoEn };
  } catch (e) {
    if (e instanceof ErrorPdf) throw e;
    throw new ErrorPdf("PDF_ERROR_INTERNO");
  }
}
