/**
 * Los textos del simulador, en un solo lugar y con pruebas (tests/unit/operar/simulador/textos.test.ts y su candado).
 * Dicen efectos y citan el plan del dueño («su regla de X dice…»); nunca juzgan la operación. Los números van sin
 * punto flotante: pesos y cantidades con el formateador exacto del plan (es-CO, «.» de miles y «,» decimal).
 */
import type { AccionPlan, CondicionRegla, Prisma } from "@prisma/client";
import { cantidadEs, nivelEs } from "@/plan/edicion/formato";
import type { Afectacion, AvisoSimulacion, ComisionEstimada, ErrorSimulacion, FrenteAlNivel, LadoSimulado, ReglaSimulada } from "./tipos";

export const ETIQUETA_COMISION = "estimada con su historia; la tarifa real puede ser distinta";
export const COMISION_SIN_HISTORIA = "sin historia: no se estima";
export const NOTA_CAJA_SIN_COMISION = "La caja de después no incluye comisión: sin historia de ese lado no se estima.";
export const NOTA_VALORACION = "Las acciones se valoran a su último cierre; la caja se mueve al precio límite de la orden.";

const MENOS = "−";
const ACCIONES: Readonly<Record<AccionPlan, string>> = { COMPRAR: "comprar", VENDER: "vender", NO_ACTUAR: "no actuar" };
const LADOS: Readonly<Record<LadoSimulado, string>> = { COMPRAR: "compra", VENDER: "venta" };
const CAJA_ATRASADA = "La caja puede estar atrasada: el cálculo sigue con la registrada.";

/** Pesos exactos, con todos los decimales del dato: «$ 4.613,27»; negativos con «−» delante, como el tablero. */
export function textoPesos(d: Prisma.Decimal): string {
  const signo = d.isNeg() && !d.isZero() ? MENOS : "";
  return `${signo}$ ${nivelEs(d.abs().toFixed())}`;
}

export function textoComision(c: ComisionEstimada, lado: LadoSimulado): string {
  if (c.estado === "SIN_HISTORIA") return COMISION_SIN_HISTORIA;
  const ordenes = c.ordenesBase === 1 ? "orden" : "órdenes";
  return `${ETIQUETA_COMISION} · con ${cantidadEs(BigInt(c.ordenesBase))} ${ordenes} de ${LADOS[lado]}`;
}

export function textoError(e: ErrorSimulacion): string {
  switch (e.codigo) {
    case "LADO_INVALIDO":
      return "La operación no es una compra ni una venta.";
    case "CANTIDAD_NO_POSITIVA":
      return "La cantidad no es un número entero mayor que cero.";
    case "PRECIO_NO_POSITIVO":
      return "El precio límite no es un número mayor que cero.";
    case "PRECIO_FUERA_DE_ESCALA":
      return "El precio límite tiene más de 6 decimales o es demasiado grande para calcularlo con exactitud.";
    case "ESPECIE_DESCONOCIDA":
      return "La especie no está en su portafolio en 008: no hay cantidad ni cierre para simular.";
    case "VENTA_SUPERA_TENENCIA":
      return `La venta es de ${cantidadEs(e.pide)} acciones y usted tiene ${cantidadEs(e.tiene)}.`;
    case "ORDEN_FUERA_DE_RANGO":
      return "El valor de la orden es demasiado grande para calcularlo con exactitud.";
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

const FRENTES = { BAJO: "por debajo del nivel", SOBRE: "por encima del nivel" } as const;
const frenteEs = (f: FrenteAlNivel): string => (f.estado === "EN_EL_NIVEL" ? "en el nivel" : FRENTES[f.lado]);

export function textoAfectacion(a: Afectacion): string {
  switch (a.tipo) {
    case "MONTO_ORDEN_BAJO":
      return "El valor de esta orden queda por debajo del monto mínimo por orden de su regla.";
    case "PRECIO_DEL_LADO_DEL_NIVEL":
      return `El precio de esta orden queda ${frenteEs(a.frente)} de su regla.`;
    case "OTRA_ACCION":
      return `Su plan para esta especie dice: ${ACCIONES[a.accionDelPlan]}.`;
  }
}

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
      return ` · lo que escribió: «${detalle}»`;
  }
}

/**
 * «Su regla de FICTICIA-A dice: vender 41 si el cierre queda por encima de $ 4.600,13.» La acción, la cantidad, la
 * condición y el nivel salen de la regla tal cual. `especie` es el nombre de la especie operada; una regla de
 * portafolio dice «portafolio».
 */
export function textoRegla(r: ReglaSimulada, especie: string): string {
  const sujeto = r.instrumentoId === null ? "portafolio" : especie;
  const cantidad = r.cantidad === null ? "" : ` ${cantidadEs(r.cantidad)}`;
  return `Su regla de ${sujeto} dice: ${ACCIONES[r.accion]}${cantidad}${condicionEs(r.condicion, r.nivel, r.detalle)}.`;
}
