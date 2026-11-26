/**
 * De dónde viene cada dato y qué tan viejo puede llegar (frente fuente-retraso): la tabla de fuentes como
 * CONFIGURACIÓN, no fija en los componentes. Una fila por fuente: cómo se llama en pantalla, su retraso típico y una
 * nota. La usan el componente de la procedencia (src/app/_comun/fecha-dato/), el pie del Tablero y, después, el frente
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
  /** Retraso típico en la rueda, dicho para ir después de «en la rueda, »; null si la fuente no da precios en rueda. */
  readonly retrasoRueda: string | null;
  /** Qué es el dato de cierre de esta fuente. */
  readonly retrasoCierre: string;
  readonly nota: string;
}

export const FUENTES: readonly FuenteDato[] = [
  {
    codigo: "yahoo", porPrefijo: false, nombre: "Yahoo (BVC)", retrasoRueda: "hasta 20 min de retraso",
    retrasoCierre: "cierre oficial del día", nota: "Precios de las acciones de la BVC (.CL) que publica Yahoo. No es tiempo real.",
  },
  {
    codigo: "sfc:", porPrefijo: true, nombre: "SFC", retrasoRueda: null,
    retrasoCierre: "valor oficial del día, publicado por la Superintendencia Financiera", nota: "Datos abiertos de la Superintendencia Financiera de Colombia.",
  },
  {
    codigo: "banrep:", porPrefijo: true, nombre: "BanRep", retrasoRueda: null,
    retrasoCierre: "dato oficial del Banco de la República", nota: "Series publicadas por el Banco de la República.",
  },
  {
    codigo: "dane:", porPrefijo: true, nombre: "DANE", retrasoRueda: null,
    retrasoCierre: "dato oficial del DANE, con su fecha de publicación", nota: "Índices publicados por el DANE.",
  },
  {
    codigo: "manual", porPrefijo: false, nombre: "Escrito por usted", retrasoRueda: null,
    retrasoCierre: "dato que usted escribió, sin fuente externa", nota: "Lo escribió el dueño; 008 no lo verificó con ninguna fuente.",
  },
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

/** El retraso conocido de una fuente para ese tipo de dato; null si la tabla no lo sabe. */
export function retrasoDe(codigo: string | null, tipo: TipoDato): string | null {
  const f = fuenteDe(codigo);
  if (f === null) return null;
  return tipo === "CIERRE" ? f.retrasoCierre : f.retrasoRueda === null ? null : `en la rueda, ${f.retrasoRueda}`;
}

/** El pie del Tablero: de dónde vienen los precios y que no son tiempo real. */
export function pieDePrecios(codigo = "yahoo"): string {
  const f = fuenteDe(codigo);
  if (f === null || f.retrasoRueda === null) return "Precios: cierre diario. No es tiempo real.";
  return `Precios: ${f.nombre}, cierre diario; durante la rueda, ${f.retrasoRueda}. No es tiempo real.`;
}
