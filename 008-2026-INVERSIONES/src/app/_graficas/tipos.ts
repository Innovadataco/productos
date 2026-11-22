/**
 * API pública del módulo de gráficas (frente graficas-tablero). Lo usan el tablero y, después, la pantalla de
 * proyecciones: una serie con bandas P5–P95 y P25–P75 alrededor de una mediana, con un corte en «hoy».
 * El módulo no da formato ni calcula cifras del negocio: recibe números ya calculados en el servidor y funciones de
 * formato. Los colores van por tono (CSS), nunca por valor.
 */
import type { ReactNode } from "react";

/** Día «AAAA-MM-DD». */
export type DiaIso = string;
export type Formato = (v: number) => string;
export type Tono = "valor" | "costo" | "gana" | "pierde" | "neutro" | "c1" | "c2" | "c3" | "c4" | "c5" | "c6" | "c7" | "c8";

export interface SerieTiempo {
  readonly id: string;
  readonly nombre: string;
  readonly tono: Tono;
  /** Un valor por día de `dias`; null = sin dato (corta la línea). */
  readonly valores: readonly (number | null)[];
  readonly trazo?: "continuo" | "punteado";
}

/** Contra qué se rellena una serie: otra serie (valor frente al costo) o una constante (la TWR contra 0). */
export type Contra = { readonly serie: string } | { readonly constante: number };

/** Relleno entre una serie y su contra: un tono donde queda arriba y otro donde queda abajo. */
export interface Relleno {
  readonly serie: string;
  readonly contra: Contra;
  readonly arriba: Tono;
  readonly abajo: Tono;
}

/** Banda entre dos curvas (p. ej. P5–P95 «suave» y P25–P75 «media»). */
export interface Banda {
  readonly id: string;
  readonly nombre: string;
  readonly tono: Tono;
  readonly intensidad: "suave" | "media";
  readonly bajo: readonly (number | null)[];
  readonly alto: readonly (number | null)[];
}

/** Índices (inclusive) de `dias` que se ven. */
export interface Ventana { readonly desde: number; readonly hasta: number }

export interface EtiquetaTiempo { readonly tipo: "dia" | "mes"; readonly conAnio: boolean }

export interface PropsGraficaTiempo {
  readonly titulo: string;
  /** Texto alternativo con las cifras (las calcula el servidor; aquí solo se lee). */
  readonly resumen: string;
  readonly dias: readonly DiaIso[];
  readonly series: readonly SerieTiempo[];
  readonly rellenos?: readonly Relleno[];
  readonly bandas?: readonly Banda[];
  readonly ventana?: Ventana;
  readonly formatoY: Formato;
  readonly formatoEje: Formato;
  readonly formatoDia: (dia: DiaIso) => string;
  readonly formatoTick: (dia: DiaIso, e: EtiquetaTiempo) => string;
  readonly incluirCero?: boolean;
  /** Alto del dibujo en px (el ancho es el del contenedor). */
  readonly alto?: number;
  /** Una línea vertical con su nombre (p. ej. «Hoy» entre la historia y la proyección). */
  readonly corte?: { readonly indice: number; readonly nombre: string };
  /** Una línea más en el detalle de un día (p. ej. cuántas especies van con un cierre anterior). */
  readonly extraDetalle?: (indice: number) => string | null;
  /** Lo que va junto al título (p. ej. la TWR del rango). */
  readonly encabezado?: ReactNode;
}

export interface Segmento {
  readonly id: string;
  readonly nombre: string;
  readonly valor: number;
  readonly textoValor: string;
  readonly textoPct: string;
  /** Por defecto, el tono categórico de su posición (c1…c8). */
  readonly tono?: Tono;
  readonly detalle?: string;
  /** false: no lleva a un detalle (p. ej. «Otras»). */
  readonly elegible?: boolean;
}

export interface PropsDona {
  readonly titulo: string;
  readonly resumen: string;
  readonly segmentos: readonly Segmento[];
  readonly centro: { readonly etiqueta: string; readonly texto: string };
  /** El origen es el botón de la leyenda: a él vuelve el foco al cerrar el detalle. */
  readonly alElegir?: (id: string, origen: HTMLElement) => void;
}

export interface FilaBarra {
  readonly id: string;
  readonly nombre: string;
  readonly valor: number;
  readonly texto: string;
  readonly detalle?: string;
}

export interface PropsBarras {
  readonly titulo: string;
  readonly resumen: string;
  readonly filas: readonly FilaBarra[];
  readonly alElegir?: (id: string, origen: HTMLElement) => void;
}

export interface OpcionSelector<K extends string> { readonly clave: K; readonly texto: string; readonly disponible: boolean }

export interface PropsSelector<K extends string> {
  readonly etiqueta: string;
  readonly opciones: readonly OpcionSelector<K>[];
  readonly valor: K;
  readonly alCambiar: (clave: K) => void;
}
