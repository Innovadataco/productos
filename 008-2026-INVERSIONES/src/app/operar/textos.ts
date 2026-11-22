/**
 * Los textos de /operar (frente operar-informe), en un solo lugar y con pruebas (tests/unit/operar/informe/textos.test.ts
 * y el candado de lenguaje). La acción y la cantidad de cada regla las pone el código desde el plan, tal como el dueño
 * las escribió («Su regla de X dice: vender 37 acciones si…»); 008 no agrega consejos ni juicios. Sin comandos: la
 * pantalla la ve también la familia. Reusa el formato del tablero y del plan.
 */
import type { AccionPlan, CondicionRegla } from "@prisma/client";
import { TEXTO_TIPO } from "../datos-oficiales/formato-decretos";
import { fecha, n, numero } from "../tablero/formato";
import { precio } from "../_plan/formato";
import { textoAccionRegla, textoPlazo } from "../_plan/textos";
import type { CierreVista, EstadoReglaVista, FechaVista, ReglaOperarVista, ReglasVista } from "./tipos";

export const AVISO_DECISION = "Información calculada por 008 con su plan. La decisión es suya. 008 no recomienda comprar ni vender.";
export const PIE_OPERAR = "Esta pantalla solo muestra: no registra órdenes ni decisiones.";

export const TITULOS_GRUPO = {
  seCumplen: "Se cumplen o están en el nivel",
  cercanas: "Cerca de su nivel (a menos del 3 %)",
  resto: "El resto de sus reglas",
} as const;

export const VACIOS_GRUPO = {
  seCumplen: "Hoy ninguna regla se cumple ni está en su nivel.",
  cercanas: "Ninguna regla está a menos del 3 % de su nivel.",
  resto: "No hay más reglas.",
} as const;

export const textoPrecios = (referencia: string | null): string =>
  referencia === null ? "Precios: todavía no hay cierres de las especies del portafolio." : `Precios: último cierre disponible (${fecha(referencia)}).`;

export const textoPreciosAtrasados = (referencia: string): string => `Los precios no se han actualizado desde el ${fecha(referencia)}.`;

export const textoVersion = (v: ReglasVista["version"]): string =>
  v === null ? "Hoy no rige ninguna versión del plan." : `Plan vigente: versión ${v.numero}, desde el ${fecha(v.desde)}.`;

/** «37 acciones», «1 acción». */
const acciones = (cantidad: string): string => (cantidad === "1" ? "1 acción" : `${numero(n(cantidad))} acciones`);

interface Accion {
  readonly accion: AccionPlan;
  readonly cantidad: string | null;
  readonly condicion: CondicionRegla;
  readonly nivel: string | null;
}

/** «vender 37 acciones», «comprar», «no actuar (43 acciones)». */
function accionYCantidad(r: Accion): string {
  const accion = textoAccionRegla(r.accion);
  if (r.cantidad === null) return accion;
  return r.accion === "NO_ACTUAR" ? `${accion} (${acciones(r.cantidad)})` : `${accion} ${acciones(r.cantidad)}`;
}

/** « si el cierre queda por debajo de $ 4.613,17», «, sin condición»; nada para una regla escrita. */
function condicionYNivel(r: Accion): string {
  switch (r.condicion) {
    case "CIERRE_BAJO":
      return ` si el cierre queda por debajo de ${precio(r.nivel)}`;
    case "CIERRE_SOBRE":
      return ` si el cierre queda por encima de ${precio(r.nivel)}`;
    case "MONTO_ORDEN_BAJO":
      return ` si el monto por orden es menor a ${precio(r.nivel)}`;
    case "NINGUNA":
      return ", sin condición";
    case "LIBRE":
      return "";
  }
}

const deLaRegla = (especie: string | null): string => `su regla de ${especie ?? "portafolio"}`;

/** «Su regla de FICTICIA-A dice: vender 37 acciones si el cierre queda por debajo de $ 4.613,17.» */
export function fraseRegla(r: ReglaOperarVista): string {
  const de = deLaRegla(r.especie);
  const quien = `${de.charAt(0).toUpperCase()}${de.slice(1)}`;
  if (r.condicion === "LIBRE") return `${quien} dice: «${r.detalle}».`;
  return `${quien} dice: ${accionYCantidad(r)}${condicionYNivel(r)}.`;
}

export const textoPlazoRegla = (plazo: string | null, vencido: boolean): string => `Plazo: ${textoPlazo(plazo, vencido)}.`;

/** «+1,79 %», «−2,99 %»: con signo y dos decimales (los de `estadoDelNivel`). */
export function distancia(pct: string): string {
  const v = n(pct);
  return `${v > 0 ? "+" : ""}${numero(v, 2)} %`;
}

export interface TextoEstado {
  readonly principal: string;
  /** Se pinta como aviso: la regla no se pudo medir con un cierre al día. */
  readonly aviso: boolean;
}

const delCierre = (c: CierreVista): string => `el cierre del ${fecha(c.fecha)}`;
const LADO = { BAJO: "por debajo del nivel", SOBRE: "por encima del nivel" } as const;

/**
 * Cómo está la regla hoy. Solo una regla tocada dice «se cumple»; si la carga de precios se detuvo, no dice «Hoy»: dice
 * con qué cierre se cumple.
 */
export function textoEstadoRegla(e: EstadoReglaVista, preciosAtrasados: boolean): TextoEstado {
  switch (e.tipo) {
    case "TOCADA":
      return {
        principal: preciosAtrasados
          ? `Se cumple con el último cierre disponible, del ${fecha(e.cierre.fecha)}: ${precio(e.cierre.precio)}, ${LADO[e.lado]}.`
          : `Hoy se cumple: ${delCierre(e.cierre)} fue de ${precio(e.cierre.precio)}, ${LADO[e.lado]}.`,
        aviso: false,
      };
    case "EN_EL_NIVEL":
      return { principal: `El cierre del ${fecha(e.cierre.fecha)} quedó en el nivel: ${precio(e.cierre.precio)}.`, aviso: false };
    case "A_DISTANCIA":
      return { principal: `El cierre del ${fecha(e.cierre.fecha)} fue de ${precio(e.cierre.precio)}: está a ${distancia(e.distanciaPct)} del nivel.`, aviso: false };
    case "SIN_CIERRE_AL_DIA":
      return {
        principal: e.ultimo
          ? `Sin cierre al día: el último cierre es del ${fecha(e.ultimo.fecha)} (${precio(e.ultimo.precio)}).`
          : "Sin cierre al día: no hay un cierre de esta especie.",
        aviso: true,
      };
    case "POR_ORDEN":
      return { principal: "008 no la mide con los cierres: aplica al monto de cada orden.", aviso: false };
    case "POSTURA":
      return { principal: "Es una postura del plan: no depende de un nivel de precio.", aviso: false };
    case "SIN_NIVEL":
      return { principal: "El plan no trae un nivel para medirla.", aviso: true };
  }
}

/** Las acciones de la especie hoy, según las órdenes cargadas. */
export function textoTenencia(tenencia: string): string {
  const v = n(tenencia);
  if (v < 0) return "acciones de hoy por verificar: faltan compras cargadas";
  return v === 0 ? "sin acciones hoy" : `con ${acciones(tenencia)} hoy`;
}

export interface TextoFecha {
  readonly cuando: string;
  readonly que: string;
  readonly detalle: string;
}

export function textoFecha(f: FechaVista): TextoFecha {
  if (f.tipo === "EX_DIVIDENDO") {
    return {
      cuando: fecha(f.fecha),
      que: `Ex-dividendo de ${f.especie ?? "una especie sin nemotécnico"}`,
      detalle: `${TEXTO_TIPO[f.tipoDividendo].toLowerCase()}, cuota ${f.cuota}: ${precio(f.valorPorAccion)} por acción; pago el ${fecha(f.fechaPago)}; ${textoTenencia(f.tenencia)}.`,
    };
  }
  return { cuando: fecha(f.fecha), que: `Último día del plazo de ${deLaRegla(f.especie)}`, detalle: `${accionYCantidad(f)}${condicionYNivel(f)}.` };
}
