/**
 * Los textos de las pantallas del plan y del diario (fase B, corte 3), en un solo lugar y con pruebas
 * (tests/unit/plan/textos.test.ts). Para el dueño: sin comandos y sin recomendar comprar ni vender. Las acciones
 * son las de sus reglas y sus decisiones, nunca una sugerencia del sistema.
 */
import type { AccionPlan, CondicionRegla } from "@prisma/client";
import type { MotivoSinDividendos } from "@/plan/dividendos";
import { cop, fecha, n, pct } from "../tablero/formato";
import { precio } from "./formato";
import type { CierreVista, ConteoVista, NivelVista, ResultadoVista } from "./tipos";

export const NOTA_INFERENCIA =
  "«Sin negociación» se deduce de que no hay cierre en esos días hábiles de la BVC; el sistema no guarda el volumen de los días omitidos.";
// Lo ve también el familiar (frente familia-lectura): «el plan aprobado», no «el que usted aprobó».
export const PIE_PLAN = "El sistema calcula y muestra; no recomienda comprar ni vender. Las reglas son las del plan aprobado.";
export const PIE_DIARIO = "El sistema mide decisiones pasadas; no recomienda comprar ni vender. Dividendos según los archivos de Trii; cierres de Yahoo.";
export const NOTA_FUENTES = "Los dividendos salen de los archivos de Trii; los cierres, de Yahoo.";

export const MOTIVOS_SIN_DIVIDENDOS: Readonly<Record<MotivoSinDividendos, string>> = {
  SIN_TENENCIA: "no quedaron acciones en la ventana para saber qué pagó la especie",
  TENENCIA_CAMBIA_CERCA_DEL_PAGO: "la tenencia cambió en los 10 días anteriores a un pago (aproximación de la fecha ex, que la base no tiene)",
  CARGA_NO_CUBRE: "la última carga de los archivos de Trii es anterior a la fecha objetivo",
  ESCISION_SIN_LOTE: "falta el lote de la escisión de la que salió la especie",
};

const CONDICIONES: Readonly<Record<CondicionRegla, string>> = {
  NINGUNA: "Sin condición",
  CIERRE_BAJO: "Cierre por debajo de",
  CIERRE_SOBRE: "Cierre por encima de",
  MONTO_ORDEN_BAJO: "Monto por orden menor a",
  LIBRE: "Regla escrita",
};
const ACCIONES_REGLA: Readonly<Record<AccionPlan, string>> = { COMPRAR: "comprar", VENDER: "vender", NO_ACTUAR: "no actuar" };
const ACCIONES_DECISION: Readonly<Record<AccionPlan, string>> = { COMPRAR: "Comprar", VENDER: "Vender", NO_ACTUAR: "No actuar" };
const VEREDICTOS = { FUNCIONO: "Funcionó", NO_FUNCIONO: "No funcionó", NEUTRO: "Neutro" } as const;

export const textoCondicion = (c: CondicionRegla): string => CONDICIONES[c];
export const textoAccionRegla = (a: AccionPlan): string => ACCIONES_REGLA[a];
export const textoAccionDecision = (a: AccionPlan, excepcion: boolean): string => `${ACCIONES_DECISION[a]}${excepcion ? " (excepción a la regla)" : ""}`;

export function textoPlazo(plazo: string | null, vencido: boolean): string {
  if (plazo === null) return "sin plazo";
  return vencido ? `venció el ${fecha(plazo)}` : `hasta el ${fecha(plazo)}`;
}

/** «Cierre por encima de $ 1.200 → vender»: la regla citada en una línea. */
export const textoRegla = (condicion: CondicionRegla, nivel: string | null, accion: AccionPlan): string =>
  `${textoCondicion(condicion)}${nivel === null ? "" : ` ${precio(nivel)}`} → ${textoAccionRegla(accion)}`;

const verificacion = (verificado: boolean): string => (verificado ? "verificado A&V" : "sin verificar");

export interface TextoCierre {
  readonly principal: string;
  readonly detalle: string | null;
  /** Se pinta como aviso: el precio no es de la fecha de referencia. */
  readonly aviso: boolean;
}

export function textoCierre(c: CierreVista): TextoCierre {
  switch (c.estado) {
    case "NO_APLICA":
      return { principal: "—", detalle: null, aviso: false };
    case "SIN_CIERRE":
      return { principal: "sin cierre", detalle: null, aviso: false };
    case "SIN_LOTES":
      return { principal: "sin cierre: el sistema solo trae cierres de las especies con compras", detalle: null, aviso: false };
    case "AL_DIA":
      return { principal: `${precio(c.precio)} · ${fecha(c.ultimo)}`, detalle: verificacion(c.verificado), aviso: false };
    case "SIN_NEGOCIACION":
      return { principal: `sin negociación desde ${fecha(c.desde)}, último cierre ${fecha(c.ultimo)}`, detalle: `cierre de ${precio(c.precio)} · ${verificacion(c.verificado)}`, aviso: true };
    case "SIN_CALENDARIO":
      return {
        principal: `último cierre ${fecha(c.ultimo)} · sin calendario de la BVC de ${c.anio} para fechar desde cuándo no se negocia`,
        detalle: `cierre de ${precio(c.precio)} · ${verificacion(c.verificado)}`,
        aviso: true,
      };
  }
}

export function textoNivel(v: NivelVista): string {
  switch (v.estado) {
    case "SIN_NIVEL":
      return "—";
    case "SIN_CIERRE_AL_DIA":
      return "sin cierre al día";
    case "TOCADA":
      return v.lado === "BAJO" ? "tocada · cierre bajo el nivel" : "tocada · cierre sobre el nivel";
    case "EN_EL_NIVEL":
      return "en el nivel";
    case "A_DISTANCIA":
      return `a ${pct(n(v.distanciaPct))} del nivel`;
  }
}

const pesos = (s: string | null): string => cop(n(s), true);

export interface TextoResultado {
  readonly principal: string;
  readonly notas: readonly string[];
}

function textoCalculado(r: ResultadoVista): TextoResultado {
  const veredicto = r.veredicto === null ? "Sin veredicto" : VEREDICTOS[r.veredicto];
  const notas = [
    r.incluyeDividendos
      ? `precio ${pesos(r.resultadoPrecio)} · dividendos ${pesos(r.dividendosPesos)}`
      : `solo precio, sin dividendos: ${r.motivoSinDividendos === null ? "no se pudieron medir" : MOTIVOS_SIN_DIVIDENDOS[r.motivoSinDividendos]}`,
    ...(r.escisionEnVentana ? ["hubo una escisión de la especie en la ventana: el precio cae por la escisión"] : []),
    ...(r.verificado ? [] : ["cierres sin verificar con A&V"]),
  ];
  return { principal: `${veredicto} · ${pesos(r.resultadoPesos)}`, notas };
}

export function textoResultado(r: ResultadoVista): TextoResultado {
  switch (r.estado) {
    case "CALCULADO":
      return textoCalculado(r);
    case "PENDIENTE":
      return { principal: `Pendiente hasta el ${fecha(r.fechaObjetivo)}`, notas: [] };
    case "SIN_PRECIO":
      return { principal: `Sin precio: falta un cierre de Yahoo entre el ${fecha(r.sinPrecioDesde)} y el ${fecha(r.sinPrecioHasta)}`, notas: [] };
    case "SIN_ORDEN":
      return { principal: "Sin orden enlazada", notas: [] };
  }
}

const PARTES: readonly (readonly [keyof ConteoVista, string, string])[] = [
  ["funciono", "funcionó", "funcionaron"],
  ["noFunciono", "no funcionó", "no funcionaron"],
  ["neutro", "neutra", "neutras"],
  ["sinVeredicto", "sin veredicto", "sin veredicto"],
  ["pendiente", "pendiente", "pendientes"],
  ["sinPrecio", "sin precio", "sin precio"],
  ["sinOrden", "sin orden enlazada", "sin orden enlazada"],
];

/** «A 30 días: 1 funcionó · 2 pendientes»: solo conteos (sumar pesos de decisiones distintas engañaría). */
export function textoConteos(dias: 30 | 90, c: ConteoVista): string {
  const partes = PARTES.filter(([k]) => c[k] > 0).map(([k, uno, varios]) => `${c[k]} ${c[k] === 1 ? uno : varios}`);
  return `A ${dias} días: ${partes.length === 0 ? "ninguna decisión medida" : partes.join(" · ")}`;
}

export const filaImportada = (filaNo: number, cargadaEl: string): string => `fila ${filaNo} de la carga del ${fecha(cargadaEl)}`;
