/**
 * Los supuestos de la proyección en texto llano: método, ventana, días por posición, reglas aplicadas y lo que no
 * se modela. Cada aviso tiene su texto. Ningún texto recomienda comprar, vender ni mantener (lo fija una prueba).
 * Puro.
 */
import type { ArmadoHistoria } from "./historia";
import { BLOQUE, MINIMO_DIAS, VENTANA_EX_DIAS } from "./metodo";
import type { AvisoCrudo, CodigoAviso, Frecuencia, ParametrosProyeccion, PosicionSupuesta, Supuestos } from "./tipos";

const PCT = 100;
const FRECUENCIA_TEXTO: Readonly<Record<Frecuencia, string>> = { MENSUAL: "mensual", TRIMESTRAL: "trimestral", SEMESTRAL: "semestral", ANUAL: "anual" };

const decimal = (x: number, decimales: number): string => x.toFixed(decimales).replace(".", ",");
const porcentaje = (fraccion: number, decimales = 1): string => `${decimal(fraccion * PCT, decimales)} %`;
const pesos = (x: number): string => `$ ${Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const dias = (n: number, que = "con cierre"): string => `${n} ${n === 1 ? "día" : "días"} ${que}`;
const DIA_EN_CERO = "el retorno de ese día se toma como 0 %";

const TEXTO_AVISO: Readonly<Record<CodigoAviso, (a: AvisoCrudo, n: string) => string>> = {
  HISTORIA_CORTA: (a, n) => `${n}: ${dias(a.dato ?? 0)}, menos de ${MINIMO_DIAS}: queda fija en su valor de hoy, sin retorno, volatilidad ni dividendos.`,
  HISTORIA_CORTA_EN_VENTANA: (a, n) =>
    `${n}: tiene ${MINIMO_DIAS} o más días con cierre, pero solo ${dias(a.dato ?? 0)} en la ventana común: queda fija en su valor de hoy, sin retorno, volatilidad ni dividendos.`,
  SIN_VALOR: (_, n) => `${n}: sin cierres ni valores de unidad hasta hoy; no se puede valorar y queda fuera del valor.`,
  ESPECIE_INCOMPLETA: (_, n) => `${n}: tiene ventas sin asignar a sus lotes; queda fuera hasta completar la carga de órdenes.`,
  ESCISION_SIN_RAZON: (a, n) => `${n}: la escisión que mueve su precio el ${a.dia} no tiene razón registrada; ${DIA_EN_CERO}.`,
  ESCISION_SIN_CIERRE_DESTINO: (a, n) => `${n}: la escisión que mueve su precio el ${a.dia} no tiene cierre del destino ese día; ${DIA_EN_CERO}.`,
  ESCISION_ENCADENADA: (a, n) => `${n}: la escisión del ${a.dia} sigue en cadena el mismo día; ${DIA_EN_CERO}.`,
  SALTO_SIN_EVENTO: (a, n) => `${n}: el ${a.dia} el precio cambió más de lo que cabe en un día sin un evento registrado (posible desdoblamiento); ${DIA_EN_CERO}.`,
  DIVIDENDO_SIN_TENENCIA: (a, n) =>
    `${n}: el dividendo del ${a.dia} no tiene tenencia que lo cobrara (la del día anterior a la fecha ex de su decreto o, sin decreto, la del día del pago); no se usa.`,
  DIVIDENDO_TENENCIA_CAMBIA: (a, n) =>
    `${n}: la tenencia cambió en los ${VENTANA_EX_DIAS} días previos al dividendo del ${a.dia}, un pago sin decreto registrado; no se sabe qué acciones lo cobraron y no se usa.`,
  DIVIDENDO_DECRETO_EN_DUDA: (a, n) =>
    `${n}: el dividendo del ${a.dia} cabe en las ventanas de decretos con dos fechas de pago o llegó antes de la fecha ex de su decreto; no se sabe qué acciones lo cobraron y no se usa.`,
  DIVIDENDO_EX_DISTINTAS: (a, n) =>
    `${n}: el dividendo del ${a.dia} junta decretos con fechas ex distintas y la tenencia cambió entre ellas; no se puede repartir y no se usa.`,
  DECRETO_BRUTO: (a, n) => `${n}: el decreto con pago el ${a.dia} entra con su valor bruto por acción (sin la retención).`,
  ANIO_SIN_CALENDARIO: (a) => `El calendario de la BVC de ${a.dato} no está sembrado: sus festivos no se pueden descartar.`,
  SIN_POSICIONES_PROYECTADAS: () => `Ninguna posición tiene ${MINIMO_DIAS} días con cierre: las bandas no muestran riesgo y no son una certeza.`,
  SIN_POSICIONES_VALORADAS: () => "No hay posiciones valoradas: solo se suman los aportes, sin retorno.",
};

export function textoAviso(a: AvisoCrudo): string {
  return TEXTO_AVISO[a.codigo](a, a.nombre ?? "La posición");
}

function textoPosicion(p: PosicionSupuesta, conVentana: boolean): string {
  const que = p.tipo === "FONDO" ? "con valor de unidad" : "con cierre";
  const enVentana = `${dias(p.diasEnVentana, que)} en la ventana (${p.diasTotales} en total)`;
  switch (p.estado) {
    case "PROYECTADA":
      return `${p.nombre}: ${enVentana}; se proyecta.`;
    case "FIJA_HISTORIA_CORTA": {
      const cuantos = conVentana && p.diasEnVentana !== p.diasTotales ? enVentana : dias(p.diasTotales, que);
      return `${p.nombre}: ${cuantos}, menos de ${MINIMO_DIAS}: queda fija en su valor de hoy (${porcentaje(p.peso ?? 0)} del valor).`;
    }
    case "EXCLUIDA_SIN_VALOR":
      return `${p.nombre}: sin datos hasta hoy; no se puede valorar y queda fuera.`;
  }
}

function textoDividendos(p: PosicionSupuesta): string {
  if (p.dividendosUsados === 0) return `${p.nombre}: sin dividendos conocidos en la ventana; su retorno es solo de precio.`;
  const cuantos = p.dividendosUsados === 1 ? "1 dividendo conocido" : `${p.dividendosUsados} dividendos conocidos`;
  return `${p.nombre}: ${cuantos} en la ventana desde ${p.primerDividendo}; antes de ese día su retorno es solo de precio.`;
}

function textosEscenario(a: ArmadoHistoria, p: ParametrosProyeccion, fraccion: number): string[] {
  return [
    p.reinvertirDividendos
      ? "Los dividendos se reinvierten en la misma especie el día que se cobran."
      : "Los dividendos se cobran: salen del valor y se suman aparte (cuentan en la probabilidad de terminar por debajo de lo aportado).",
    p.aportePeriodico > 0
      ? `Aporte ${FRECUENCIA_TEXTO[p.frecuenciaAporte]} de ${pesos(p.aportePeriodico)} al final de cada periodo, repartido con los pesos de hoy.`
      : "Sin aportes.",
    p.caidaInicialPct > 0 ? `Caída inicial de ${decimal(p.caidaInicialPct, 1)} % aplicada hoy a todas las posiciones, también al fondo.` : "Sin caída inicial.",
    "El valor es el de las acciones y el fondo; no incluye el efectivo de la cuenta. Lo aportado es el valor de hoy más los aportes del escenario, no el costo histórico.",
    "La caída máxima se mide sobre el valor sin los aportes (como la TWR) y se informa su mediana entre trayectorias.",
    ...(a.columnas.length > 0 && fraccion < 1 ? [`El ${porcentaje(fraccion)} del valor de hoy tiene riesgo modelado; el resto queda fijo.`] : []),
    ...(a.rendimientoAnualVentana !== null && a.volatilidadAnualVentana !== null
      ? [`En la ventana, el portafolio de hoy (con sus pesos) rindió ${porcentaje(a.rendimientoAnualVentana)} anual con una volatilidad de ${porcentaje(a.volatilidadAnualVentana)} anual; la proyección repite esa historia y no la corrige.`]
      : []),
    ...(a.decretosFuturos > 0 ? [`Hay ${a.decretosFuturos} ${a.decretosFuturos === 1 ? "decreto" : "decretos"} con pago futuro: no se suman aparte, la historia de dividendos ya los representa.`] : []),
  ];
}

export function armarSupuestos(a: ArmadoHistoria, p: ParametrosProyeccion): Supuestos {
  const proyectado = a.columnas.reduce((s, c) => s + c.valorHoy, 0);
  const fraccion = a.valorHoy > 0 ? proyectado / a.valorHoy : 0;
  const v = a.ventana;
  const textos = [
    `Método: remuestreo de la historia (bootstrap circular) en bloques de ${BLOQUE} ruedas consecutivas, el mismo día para todas las posiciones (así conserva su correlación); ${p.trayectorias} trayectorias con la semilla ${p.semilla} (la misma semilla da el mismo resultado).`,
    v
      ? `Ventana histórica: del ${v.desde} al ${v.hasta}, ${v.ruedas} ruedas de la BVC (≈ ${decimal(a.historia.ruedasPorMes, 1)} por mes); la fija ${v.limitadaPor}, la posición de historia más corta.`
      : `Sin ventana histórica: ninguna posición tiene ${MINIMO_DIAS} días con cierre.`,
    `Mínimo de historia: ${MINIMO_DIAS} días con cierre; con menos, la posición queda fija en su valor de hoy.`,
    ...a.posiciones.map((x) => textoPosicion(x, v !== null)),
    ...a.posiciones.filter((x) => x.estado === "PROYECTADA" && x.tipo === "ACCION").map(textoDividendos),
    ...textosEscenario(a, p, fraccion),
  ];
  return {
    ventana: v, ruedasPorMes: a.historia.ruedasPorMes, bloque: BLOQUE, minimoDias: MINIMO_DIAS, fraccionProyectada: fraccion,
    rendimientoAnualVentana: a.rendimientoAnualVentana, volatilidadAnualVentana: a.volatilidadAnualVentana, decretosFuturos: a.decretosFuturos,
    posiciones: a.posiciones, avisos: a.avisos.map((x) => ({ ...x, texto: textoAviso(x) })), textos,
  };
}
