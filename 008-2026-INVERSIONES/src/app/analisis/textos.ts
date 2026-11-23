/**
 * Los textos de /analisis (frente analisis-pantalla, A2). Puro: solo formato, sin cálculo. Cada punto para revisar dice
 * qué dato cruzó qué umbral, con el umbral a la vista y tomado del catálogo del motor (src/analisis/catalogo.ts): nunca
 * un juicio ni una acción. El candado de lenguaje (tests/unit/pantalla-analisis/lenguaje.candado.test.ts) recorre este
 * archivo y la pantalla pintada.
 */
import { CRITERIOS, type ClaveObservacion, type Comparacion, type Observacion } from "@/analisis/catalogo";
import { cop, fecha, numero, pct } from "../tablero/formato";

const CIEN = 100;

export const TITULO = "Análisis del portafolio";
export const PIE_ANALISIS = "El sistema calcula y muestra; no recomienda comprar ni vender. Los puntos para revisar dicen qué dato cruzó qué umbral; la decisión es suya.";
export const TITULO_VOLATILIDAD = "Volatilidad anual de precios diarios";
export const NOTA_VOLATILIDAD =
  "La volatilidad sale de los retornos diarios de los cierres (Yahoo), anualizada: no es la de los escenarios de Proyecciones, que simula meses.";
export const NOTA_VENTANAS = "Las ventanas son el rendimiento total del período: el precio más los dividendos del día del pago, reinvertidos.";
export const NOTA_FONDO = "El riesgo, la concentración y la tabla por especie son solo de las acciones: el fondo entra solo en el valor y su peso.";
export const SIN_PUNTOS = "Ningún dato cruza hoy un umbral del catálogo.";
export const SIN_DECISIONES = "Sin decisiones registradas.";
export const SIN_VEREDICTO_TODAVIA = "Ninguna tiene veredicto todavía: no hay resultado en pesos.";
export const DIARIO_PARCIAL = "El diario tiene más decisiones de las que se leen de una vez: esta cuenta es parcial (las más recientes).";

export const SIN_HISTORIA = "sin historia";
export const SIN_HISTORIA_SUFICIENTE = "sin historia suficiente";
export const SIN_CIERRE = "sin cierre";
export const SIN_RIESGO = "sin riesgo que repartir";
export const SIN_VARIACION = "sin variación";
export const SIN_CAIDA = "sin caída";
export const SIN_CAIDA_HISTORICA = "sin caída histórica";
export const SIN_VALOR = "sin valor";

/** Una fracción como porcentaje sin signo, con un decimal: 0,2137 → «21,4 %». */
export const porcentaje = (fraccion: number, decimales = 1): string => `${numero(fraccion * CIEN, decimales)} %`;
/** Una fracción como porcentaje con signo: 0,0473 → «+4,7 %». */
export const conSigno = (fraccion: number): string => pct(fraccion * CIEN);

const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;
const dias = (n: number): string => plural(n, "día", "días");

/** El conector de cada comparación del catálogo (`cumple`): el texto sigue a la comparación, no al revés. */
function comparado(c: Comparacion, medida: string): string {
  switch (c) {
    case "MAYOR_QUE":
      return `más de ${medida}`;
    case "MAYOR_O_IGUAL":
      return `${medida} o más`;
    case "MENOR_QUE":
      return `menos de ${medida}`;
    case "DE_CERO_HASTA":
    case "VALOR_ABSOLUTO_HASTA":
      return `${medida} o menos`;
    case "PASA_EL_NIVEL":
      return "el nivel de su regla";
  }
}

/** La medida de cada clave con los números del catálogo, y lo que la acompaña. */
const MEDIDAS: Readonly<Record<ClaveObservacion, { readonly medida: string; readonly ademas?: string }>> = {
  CONCENTRACION_ALTA: { medida: porcentaje(CRITERIOS.CONCENTRACION_ALTA.umbral, 0) },
  CONCENTRACION_TOP_TRES: { medida: porcentaje(CRITERIOS.CONCENTRACION_TOP_TRES.umbral, 0), ademas: `con ${CRITERIOS.CONCENTRACION_TOP_TRES.auxiliares.minimoEspecies} especies o más` },
  CORRELACION_ALTA: { medida: numero(CRITERIOS.CORRELACION_ALTA.umbral, 2) },
  CONTRIBUCION_RIESGO_DESPROPORCIONADA: {
    medida: `${numero(CRITERIOS.CONTRIBUCION_RIESGO_DESPROPORCIONADA.umbral, 1)} veces su peso`,
    ademas: `con un aporte de al menos ${porcentaje(CRITERIOS.CONTRIBUCION_RIESGO_DESPROPORCIONADA.auxiliares.contribucionMinima, 0)}`,
  },
  REGLA_CUMPLIDA: { medida: "" },
  REGLA_CERCANA: { medida: `${numero(CRITERIOS.REGLA_CERCANA.umbral)} %` },
  REGLA_VENCE_PRONTO: { medida: dias(CRITERIOS.REGLA_VENCE_PRONTO.umbral) },
  REGLA_VENCIDA: { medida: dias(CRITERIOS.REGLA_VENCIDA.umbral), ademas: "después del plazo" },
  PRECIO_ATRASADO: { medida: `${plural(CRITERIOS.PRECIO_ATRASADO.umbral, "rueda", "ruedas")} sin cierre` },
  PRECIOS_SIN_ACTUALIZAR: { medida: `${plural(CRITERIOS.PRECIOS_SIN_ACTUALIZAR.umbral, "rueda", "ruedas")} de atraso` },
  DECISION_RESULTADO_NEGATIVO: {
    medida: `conocido hace ${dias(CRITERIOS.DECISION_RESULTADO_NEGATIVO.umbral)}`,
    ademas: `con un resultado menor que ${cop(CRITERIOS.DECISION_RESULTADO_NEGATIVO.auxiliares.resultadoPesosMenorQue)}`,
  },
  EX_DIVIDENDO_PRONTO: { medida: dias(CRITERIOS.EX_DIVIDENDO_PRONTO.umbral) },
  HISTORIA_INSUFICIENTE: { medida: dias(CRITERIOS.HISTORIA_INSUFICIENTE.umbral) },
};

export function textoUmbral(clave: ClaveObservacion): string {
  const { medida, ademas } = MEDIDAS[clave];
  const base = comparado(CRITERIOS[clave].comparacion, medida);
  return `umbral: ${ademas === undefined ? base : `${base}, ${ademas}`}`;
}

type Nombre = (id: string | null) => string;

const deRegla = (id: string | null, nombre: Nombre): string => (id === null ? "Una regla de portafolio" : `La regla de ${nombre(id)}`);

/** Lo medido, en una frase sin juicio, con los nombres del tablero (nunca los ids). */
export function textoObservacion(o: Observacion, nombre: Nombre): string {
  switch (o.clave) {
    case "CONCENTRACION_ALTA":
      return `${nombre(o.datos.instrumentoId)} pesa ${porcentaje(o.datos.peso)} del valor de las acciones.`;
    case "CONCENTRACION_TOP_TRES":
      return `Las tres de mayor valor (${o.datos.instrumentoIds.map(nombre).join(", ")}) pesan ${porcentaje(o.datos.peso)} del valor de las acciones.`;
    case "CORRELACION_ALTA":
      return `${o.datos.instrumentoIds.map(nombre).join(" y ")}: correlación de ${numero(o.datos.correlacion, 2)} en sus retornos diarios de precio.`;
    case "CONTRIBUCION_RIESGO_DESPROPORCIONADA":
      return `${nombre(o.datos.instrumentoId)} aporta ${porcentaje(o.datos.contribucionPct)} del riesgo con ${porcentaje(o.datos.pesoEnCubiertas)} del valor cubierto (${numero(o.datos.veces, 2)} veces).`;
    case "REGLA_CUMPLIDA":
      return `${deRegla(o.datos.instrumentoId, nombre)}: el último cierre pasó su nivel (${o.datos.lado === "BAJO" ? "por debajo" : "por encima"}).`;
    case "REGLA_CERCANA":
      return `${deRegla(o.datos.instrumentoId, nombre)}: el último cierre está a ${numero(Math.abs(o.datos.distanciaPct), 2)} % de su nivel.`;
    case "REGLA_VENCE_PRONTO":
      return `${deRegla(o.datos.instrumentoId, nombre)} tiene plazo hasta el ${fecha(o.datos.plazo)} (${o.datos.dias === 0 ? "hoy" : `en ${dias(o.datos.dias)}`}).`;
    case "REGLA_VENCIDA":
      return `${deRegla(o.datos.instrumentoId, nombre)} tenía plazo hasta el ${fecha(o.datos.plazo)} (hace ${dias(o.datos.dias)}) y sigue en el plan vigente.`;
    case "PRECIO_ATRASADO":
      return o.datos.ultimoCierre === null
        ? `${nombre(o.datos.instrumentoId)}: sin cierre.`
        : `${nombre(o.datos.instrumentoId)}: último cierre del ${fecha(o.datos.ultimoCierre.dia)}, sin negociación desde el ${fecha(o.datos.ultimoCierre.sinNegociacionDesde)}.`;
    case "PRECIOS_SIN_ACTUALIZAR":
      return `Los precios llegan hasta el ${fecha(o.datos.referencia)}: la carga de precios se detuvo.`;
    case "DECISION_RESULTADO_NEGATIVO":
      return `Una decisión dio ${cop(o.datos.resultadoPesos.toNumber(), true)} a ${o.datos.horizonteDias} días; se conoció el ${fecha(o.datos.conocidoEl)} (hace ${dias(o.datos.dias)}).`;
    case "EX_DIVIDENDO_PRONTO":
      return `${nombre(o.datos.instrumentoId)}: fecha ex de un dividendo el ${fecha(o.datos.fechaEx)} (${o.datos.dias === 0 ? "hoy" : `en ${dias(o.datos.dias)}`}).`;
    case "HISTORIA_INSUFICIENTE":
      return `${nombre(o.datos.instrumentoId)}: ${dias(o.datos.dias)} con cierre en la ventana común; no entra en el riesgo del portafolio.`;
  }
}
