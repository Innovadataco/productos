/**
 * El porqué de cada control de la conciliación, en español claro para el dueño (PR-C, GATE 1 aprobada).
 * Una frase por código del cálculo (src/conciliacion/controles.ts; un candado lo verifica), sin comandos ni jerga:
 * los comandos están en el runbook y en la cabecera de los CLI. Nunca recomienda comprar ni vender.
 * Tres códigos son falta de dato, no diferencia: se muestran como «No se pudo verificar» y dicen qué falta.
 */

export const MOTIVOS = {
  no_certificada: "El sistema tiene esta especie, pero la certificación de A&V no la trae.",
  sin_operaciones_en_sistema: "La certificación trae esta especie, pero el sistema no tiene operaciones de ella.",
  escision_sin_lote: "Viene de una escisión y falta registrar las acciones que se recibieron.",
  diferencia_cantidad: "La cantidad del sistema no es la de la certificación.",
  t_mas_2: "Hay operaciones hechas hasta el corte que se liquidan después (dos días hábiles): cuadra con lo operado.",
  sin_precio_al_corte: "No se pudo verificar: falta el precio de cierre del día del corte.",
  por_cantidad: "El valor no cuadra porque la cantidad no cuadra.",
  precio_distinto: "El precio de cierre del sistema no es el precio con el que A&V valoró la especie.",
  diferencia_valor: "El valor difiere en más de 0,5 % del de la certificación.",
  fecha_corte_dudosa: "Los precios del día del corte no son los de A&V (todos difieren, o son los del día hábil anterior): puede que la fecha de corte no sea la correcta.",
  por_especies: "El total no cuadra por las especies que no cuadran.",
  fondo_sin_unidades: "No se pudo verificar: falta registrar las unidades del fondo.",
  sin_valor_unidad_al_corte: "No se pudo verificar: falta el valor de la unidad del fondo del día del corte.",
  diferencia_fondo: "El saldo del fondo difiere en más de 0,5 % del de la certificación.",
  aporte_fic_sin_registrar: "Falta registrar el aporte al fondo: la caja del sistema todavía cuenta ese dinero como efectivo.",
  partida_sin_fuente: "Hay una diferencia en la caja que ningún archivo cargado explica.",
} as const satisfies Readonly<Record<string, string>>;

export type CodigoMotivo = keyof typeof MOTIVOS;

/** Falta de dato: el control no se pudo hacer. */
export const SIN_VERIFICAR: ReadonlySet<CodigoMotivo> = new Set<CodigoMotivo>(["fondo_sin_unidades", "sin_valor_unidad_al_corte", "sin_precio_al_corte"]);

const MOTIVO_DESCONOCIDO = "Hay un motivo que esta pantalla todavía no sabe explicar.";

const esCodigo = (codigo: string): codigo is CodigoMotivo => Object.prototype.hasOwnProperty.call(MOTIVOS, codigo);

export function fraseDeMotivo(codigo: string | null): string | null {
  if (codigo === null) return null;
  return esCodigo(codigo) ? MOTIVOS[codigo] : MOTIVO_DESCONOCIDO;
}

export type Tono = "cuadra" | "no-cuadra" | "por-liquidar" | "sin-verificar";

export interface Estado {
  readonly texto: string;
  readonly tono: Tono;
}

export function estadoDeControl(resultado: string, codigo: string | null): Estado {
  if (codigo !== null && esCodigo(codigo) && SIN_VERIFICAR.has(codigo)) return { texto: "No se pudo verificar", tono: "sin-verificar" };
  switch (resultado) {
    case "CUADRA":
      return { texto: "Cuadra", tono: "cuadra" };
    case "NO_CUADRA":
      return { texto: "No cuadra", tono: "no-cuadra" };
    case "PENDIENTE_LIQUIDACION":
      return { texto: "Por liquidar", tono: "por-liquidar" };
    default:
      return { texto: "Sin clasificar", tono: "sin-verificar" };
  }
}

const GLOBAL: Readonly<Record<"CUADRA" | "NO_CUADRA" | "PARCIAL", string>> = {
  CUADRA: "Cuadra",
  NO_CUADRA: "No cuadra",
  PARCIAL: "Cuadra, con operaciones por liquidar",
};

export const textoDeResultadoGlobal = (resultado: "CUADRA" | "NO_CUADRA" | "PARCIAL"): string => GLOBAL[resultado];
