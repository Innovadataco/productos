/**
 * De dónde viene cada dato y qué tan viejo puede llegar (frente fuente-retraso): la tabla de fuentes como
 * CONFIGURACIÓN, no fija en los componentes. Una fila por fuente: cómo se llama en pantalla y su retraso en la rueda. La usan el componente de la procedencia (src/app/_comun/fecha-dato/), el pie del Tablero y, después, el frente
 * de precios cada minuto. Puro y sin dependencias: lo importan componentes de servidor y de cliente.
 * Los retrasos salen de INVESTIGACION-FUENTES-PRECIOS-BVC.md (Yahoo `.CL`: 20 min en rueda, según su página de ayuda;
 * «en vivo, en rueda» por verificar). Una fuente que la tabla no conoce sale tal cual, sin retraso inventado.
 */

/** Cierre oficial del día, o un precio tomado durante la rueda. */
export type TipoDato = "CIERRE" | "RUEDA";

export interface FuenteDato {
  /** Código tal como lo guarda la base: igual, o prefijo si `porPrefijo`. */
  readonly codigo: string;
  readonly porPrefijo: boolean;
  /** Nombre visible. */
  readonly nombre: string;
  /** Retraso en la rueda, tal cual se dice en la línea del precio; null si la fuente no da precios en rueda (o no se verificó). */
  readonly retrasoRueda: string | null;
}

export const FUENTES: readonly FuenteDato[] = [
  { codigo: "yahoo", porPrefijo: false, nombre: "Yahoo (BVC)", retrasoRueda: "hasta 20 min de retraso", },
  { codigo: "sfc:", porPrefijo: true, nombre: "SFC", retrasoRueda: null, },
  { codigo: "banrep:", porPrefijo: true, nombre: "BanRep", retrasoRueda: null, },
  { codigo: "dane:", porPrefijo: true, nombre: "DANE", retrasoRueda: null, },
  { codigo: "manual", porPrefijo: false, nombre: "Escrito por usted", retrasoRueda: null, },
];

/** La fila de la tabla para un código de la base; null si no se conoce (o no hay código). */
export function fuenteDe(codigo: string | null): FuenteDato | null {
  if (codigo === null || codigo === "") return null;
  return FUENTES.find((f) => (f.porPrefijo ? codigo.startsWith(f.codigo) : codigo === f.codigo)) ?? null;
}

export const SIN_FUENTE = "fuente sin dato";

/** El nombre en pantalla; una fuente que no conoce, tal cual (no se inventa un nombre). */
export function nombreDeFuente(codigo: string | null): string {
  if (codigo === null || codigo === "") return SIN_FUENTE;
  return fuenteDe(codigo)?.nombre ?? codigo;
}

/** El pie del Tablero: de dónde vienen los precios y que no son tiempo real. */
export function pieDePrecios(codigo = "yahoo"): string {
  const f = fuenteDe(codigo);
  if (f === null || f.retrasoRueda === null) return "Precios: cierre diario. No es tiempo real.";
  return `Precios: ${f.nombre}, cierre diario; durante la rueda, ${f.retrasoRueda}. No es tiempo real.`;
}
