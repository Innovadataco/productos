/**
 * Geometría de la gráfica de tiempo: el dominio objetivo de la ventana y las capas (líneas, rellenos, bandas) en
 * coordenadas del dibujo (0–1000 de ancho, el alto en px). Puro: el componente solo lo pinta.
 */
import { dominioY, escalaLineal, type Escala } from "./escalas";
import { rutaArea, rutaLinea, rutaRegion, type Punto } from "./trazos";
import type { Banda, PropsGraficaTiempo, Relleno, SerieTiempo, Tono, Ventana } from "./tipos";

export const ANCHO = 1000;
/** Aire arriba y abajo del dibujo, en px. */
export const AIRE = 10;
export const MARCAS_Y = 4;

export type Dominio = readonly [number, number, number, number];

export function ventanaDe(ventana: Ventana | undefined, total: number): Ventana {
  const hasta = Math.max(0, Math.min(total - 1, ventana?.hasta ?? total - 1));
  return { desde: Math.max(0, Math.min(hasta, ventana?.desde ?? 0)), hasta };
}

const enVentana = (valores: readonly (number | null)[], v: Ventana) => valores.slice(v.desde, v.hasta + 1);

/** [x0, x1, y0, y1] de la ventana: los días de sus puntas y lo que ocupan sus series, bandas y constantes. */
export function dominioObjetivo(p: PropsGraficaTiempo, xs: readonly number[], v: Ventana): Dominio {
  const x0 = xs[v.desde] ?? 0;
  const x1 = xs[v.hasta] ?? 1;
  const constantes = (p.rellenos ?? []).flatMap((r) => ("constante" in r.contra ? [r.contra.constante] : []));
  const valores = [
    ...p.series.flatMap((s) => enVentana(s.valores, v)),
    ...(p.bandas ?? []).flatMap((b) => [...enVentana(b.bajo, v), ...enVentana(b.alto, v)]),
    ...constantes,
  ];
  const [y0, y1] = dominioY(valores, { cuantos: MARCAS_Y, incluirCero: p.incluirCero });
  return x0 === x1 ? [x0 - 1, x1 + 1, y0, y1] : [x0, x1, y0, y1];
}

export interface Escalas { readonly x: Escala; readonly y: Escala }

export const escalasDe = (d: Dominio, alto: number): Escalas => ({
  x: escalaLineal([d[0], d[1]], [0, ANCHO]),
  y: escalaLineal([d[2], d[3]], [alto - AIRE, AIRE]),
});

const puntos = (xs: readonly number[], valores: readonly (number | null)[], e: Escalas): Punto[] =>
  xs.map((x, i) => {
    const v = valores[i];
    return { x: e.x.a(x), y: v === null || v === undefined ? null : e.y.a(v) };
  });

export interface CapaLinea { readonly id: string; readonly tono: Tono; readonly punteado: boolean; readonly d: string }
export interface CapaRelleno { readonly arriba: Tono; readonly abajo: Tono; readonly d: string; readonly recorteArriba: string; readonly recorteAbajo: string; readonly base: number | null }
export interface CapaBanda { readonly id: string; readonly tono: Tono; readonly intensidad: Banda["intensidad"]; readonly degradado: boolean; readonly d: string }

export function lineas(series: readonly SerieTiempo[], xs: readonly number[], e: Escalas): CapaLinea[] {
  return series.map((s) => ({ id: s.id, tono: s.tono, punteado: s.trazo === "punteado", d: rutaLinea(puntos(xs, s.valores, e)) }));
}

export function rellenos(lista: readonly Relleno[], series: readonly SerieTiempo[], xs: readonly number[], e: Escalas, alto: number): CapaRelleno[] {
  return lista.flatMap((r) => {
    const serie = series.find((s) => s.id === r.serie);
    const contraSerie = "serie" in r.contra ? series.find((s) => s.id === (r.contra as { serie: string }).serie) : undefined;
    if (!serie || ("serie" in r.contra && !contraSerie)) return [];
    const base = "constante" in r.contra ? e.y.a(r.contra.constante) : null;
    const contra = contraSerie ? puntos(xs, contraSerie.valores, e) : xs.map((x) => ({ x: e.x.a(x), y: base }));
    return [{
      arriba: r.arriba, abajo: r.abajo, base,
      d: rutaArea(puntos(xs, serie.valores, e), contra),
      recorteArriba: rutaRegion(contra, 0),
      recorteAbajo: rutaRegion(contra, alto),
    }];
  });
}

export function bandas(lista: readonly Banda[], xs: readonly number[], e: Escalas): CapaBanda[] {
  return lista.map((b) => ({ id: b.id, tono: b.tono, intensidad: b.intensidad, degradado: b.degradado === true, d: rutaArea(puntos(xs, b.alto, e), puntos(xs, b.bajo, e)) }));
}

/** Índice del último valor con dato de la ventana; null si no hay. */
export function ultimoIndice(valores: readonly (number | null)[], v: Ventana): number | null {
  for (let i = v.hasta; i >= v.desde; i -= 1) {
    const x = valores[i];
    if (x !== null && x !== undefined) return i;
  }
  return null;
}

/** Último valor con dato de la ventana (para la leyenda). */
export function ultimoEnVentana(valores: readonly (number | null)[], v: Ventana): number | null {
  const i = ultimoIndice(valores, v);
  return i === null ? null : valores[i]!;
}
