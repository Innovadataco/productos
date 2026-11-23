/**
 * Los textos del simulador, en un solo lugar y con pruebas (tests/unit/operar/simulador/textos.test.ts y su candado).
 * Dicen efectos y citan el plan del dueño («su regla de X dice…»); nunca juzgan la operación. Los números van sin
 * punto flotante: pesos y cantidades con el formateador exacto del plan (es-CO, «.» de miles y «,» decimal). Lo que
 * el dueño escribió sale en una línea y sin caracteres de control ni de dirección; la pantalla lo muestra como cita.
 */
import { Prisma, type AccionPlan, type CondicionRegla, type LadoOrden } from "@prisma/client";
import { cantidadEs, nivelEs } from "@/plan/edicion/formato";
import type { Afectacion, AvisoSimulacion, ComisionEstimada, Comisionista, ErrorSimulacion, FrenteAlNivel, ReglaSimulada } from "./tipos";

export const ETIQUETA_COMISION = "estimada con su historia; la tarifa real puede ser distinta";
export const COMISION_SIN_HISTORIA = "sin historia: no se estima";
export const NOTA_CAJA_SIN_COMISION = "La caja de después no incluye comisión: sin historia de ese lado no se estima.";
export const NOTA_VALORACION = "Las acciones se valoran a su último cierre; la caja se mueve al precio límite de la orden.";

const MENOS = "−";
const ACCIONES: Readonly<Record<AccionPlan, string>> = { COMPRAR: "comprar", VENDER: "vender", NO_ACTUAR: "no actuar" };
const LADOS: Readonly<Record<LadoOrden, string>> = { COMPRA: "compra", VENTA: "venta" };
const CAJA_ATRASADA = "La caja puede estar atrasada: el cálculo sigue con la registrada.";
/** Controles (C0, C1), marcas y aislantes de dirección, y separadores de línea y de párrafo. */
const INVISIBLES = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069\u2028\u2029]/g;

/** Pesos exactos, con todos los decimales del dato: «$ 4.613,27»; negativos con «−» delante, como el tablero. */
export function textoPesos(d: Prisma.Decimal): string {
  const signo = d.isNeg() && !d.isZero() ? MENOS : "";
  return `${signo}$ ${nivelEs(d.abs().toFixed())}`;
}

/** Montos en pesos sin decimales (mitad hacia arriba, solo para mostrar): «$ 37.911»; negativos con «−». */
export function textoPesosRedondos(d: Prisma.Decimal): string {
  return textoPesos(d.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP));
}

export const ETIQUETA_TARIFA = "calculada con su tarifa";
const NOMBRE_COMISIONISTA: Readonly<Record<Comisionista, string>> = { TRII: "Trii", AV: "Acciones & Valores" };

/** «calculada con su tarifa de Trii para compra · versión 3». */
export function textoComision(c: ComisionEstimada): string {
  if (c.estado === "SIN_HISTORIA") return COMISION_SIN_HISTORIA;
  if (c.estado === "TARIFA") return `${ETIQUETA_TARIFA} de ${NOMBRE_COMISIONISTA[c.tarifa.comisionista]} para ${LADOS[c.lado]} · versión ${cantidadEs(BigInt(c.tarifa.version))}`;
  const ordenes = c.ordenesBase === 1 ? "orden" : "órdenes";
  return `${ETIQUETA_COMISION} · con ${cantidadEs(BigInt(c.ordenesBase))} ${ordenes} de ${LADOS[c.lado]}`;
}

export function textoError(e: ErrorSimulacion): string {
  switch (e.codigo) {
    case "LADO_INVALIDO":
      return "La operación no es una compra ni una venta.";
    case "CANTIDAD_NO_POSITIVA":
      return "La cantidad no es un número entero mayor que cero.";
    case "CANTIDAD_FUERA_DE_RANGO":
      return "La cantidad es demasiado grande para calcularla con exactitud.";
    case "PRECIO_NO_POSITIVO":
      return "El precio límite no es un número mayor que cero.";
    case "PRECIO_FUERA_DE_ESCALA":
      return "El precio límite tiene más de 6 decimales o es demasiado grande para calcularlo con exactitud.";
    case "ESPECIE_DESCONOCIDA":
      return "La especie no está en su portafolio en Inversiones: no hay cantidad ni cierre para simular.";
    case "VENTA_SUPERA_TENENCIA":
      return `La venta es de ${cantidadEs(e.pide)} acciones y usted tiene ${cantidadEs(e.tiene)}.`;
    case "ORDEN_FUERA_DE_RANGO":
      return "El valor de la orden, o el de la posición que deja, es demasiado grande para calcularlo con exactitud.";
  }
}

export function textoAviso(a: AvisoSimulacion): string {
  if (a.codigo === "COMPRA_SUPERA_CAJA") {
    const lo = a.conComision ? "El valor de la compra más la comisión estimada pasa la caja registrada." : "El valor de la compra pasa la caja registrada (sin comisión: no hay historia para estimarla).";
    return `${lo} ${CAJA_ATRASADA}`;
  }
  const varias = a.especies.length > 1;
  return `Sin cierre: ${a.especies.map((e) => e.nemotecnico).join(", ")}. Su valor y su peso no se calculan, y los pesos de las demás no ${varias ? "las" : "la"} cuentan.`;
}

/** Lo escrito por el dueño en una sola línea, sin controles ni marcas de dirección. */
const COMO_ESPACIO: ReadonlySet<string> = new Set(["\n", "\r", "\t", "\u2028", "\u2029"]);
const enUnaLinea = (texto: string): string =>
  texto
    .replace(INVISIBLES, (c) => (COMO_ESPACIO.has(c) ? " " : ""))
    .replace(/ {2,}/g, " ")
    .trim();

const nivelONada = (nivel: Prisma.Decimal | null): string => (nivel === null ? "un nivel sin dato" : textoPesos(nivel));

function condicionEs(condicion: CondicionRegla, nivel: Prisma.Decimal | null, detalle: string): string {
  switch (condicion) {
    case "NINGUNA":
      return "";
    case "CIERRE_BAJO":
      return ` si el cierre queda por debajo de ${nivelONada(nivel)}`;
    case "CIERRE_SOBRE":
      return ` si el cierre queda por encima de ${nivelONada(nivel)}`;
    case "MONTO_ORDEN_BAJO":
      return ` si el monto por orden es menor que ${nivelONada(nivel)}`;
    case "LIBRE":
      return ` · lo que escribió: «${enUnaLinea(detalle)}»`;
  }
}

/** «vender 41 si el cierre queda por encima de $ 4.600,13»: acción, cantidad, condición y nivel de la regla, tal cual. */
const loQueDice = (r: ReglaSimulada): string => `${ACCIONES[r.accion]}${r.cantidad === null ? "" : ` ${cantidadEs(r.cantidad)}`}${condicionEs(r.condicion, r.nivel, r.detalle)}`;

const FRENTES = { BAJO: "por debajo del nivel", SOBRE: "por encima del nivel" } as const;
const frenteEs = (f: FrenteAlNivel): string => (f.estado === "EN_EL_NIVEL" ? "en el nivel" : FRENTES[f.lado]);

/** Lo que la orden toca en la regla. Otra acción cita lo que dice el plan con su condición: no es una instrucción suelta. */
export function textoAfectacion(a: Afectacion, regla: ReglaSimulada): string {
  switch (a.tipo) {
    case "MONTO_ORDEN_BAJO":
      return "El valor de esta orden queda por debajo del monto mínimo por orden de su regla.";
    case "PRECIO_DEL_LADO_DEL_NIVEL":
      return `El precio de esta orden queda ${frenteEs(a.frente)} de su regla.`;
    case "OTRA_ACCION":
      return `Su plan para esta especie dice: ${loQueDice(regla)}.`;
  }
}

/**
 * «Su regla de FICTICIA-A dice: vender 41 si el cierre queda por encima de $ 4.600,13.» La acción, la cantidad, la
 * condición y el nivel salen de la regla tal cual. `especie` es el nombre de la especie operada; una regla de
 * portafolio dice «portafolio».
 */
export function textoRegla(r: ReglaSimulada, especie: string): string {
  const sujeto = r.instrumentoId === null ? "portafolio" : especie;
  return `Su regla de ${sujeto} dice: ${loQueDice(r)}.`;
}
