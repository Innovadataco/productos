/**
 * Los textos fijos de la tarjeta de resumen (E5). Describen, no aconsejan: los revisa el candado de lenguaje
 * (tests/unit/resumen-ia/tarjeta.test.ts, con `prohibidasEn`). El aviso de cada tipo no está aquí: lo pone el validador.
 */
import type { Calidad, TipoDiario } from "@/ia/contrato";
import type { CodigoValidador } from "@/ia/validador/codigos";
import type { Puerta } from "@/ia/generador";
import type { VigenciaResumenIa } from "./tipos";

export const TEXTOS_RESUMEN_IA = Object.freeze({
  titulos: Object.freeze({ DIARIO: "Resumen del día", REGLAS: "Resumen de las reglas", ESCENARIOS: "Resumen de los escenarios" } satisfies Record<TipoDiario, string>),
  eyebrow: "En dos líneas",
  cifrasUsadas: "Cifras usadas",
  redactadoEn: "Redactado el",
  sinIa: "Resumen sin IA",
  noDisponible: "Sin resumen",
  /** El motivo, para todos, cuando la configuración tiene la IA apagada: sin decir qué ajuste es. */
  iaApagada: "IA apagada",
  /** Solo la casilla del análisis a demanda está apagada: la IA sigue con el resumen diario a esa hora (`{hora}`). */
  demandaApagada: "Análisis a demanda apagado; el resumen diario sigue a las {hora}.",
  modeloSinNombre: "modelo sin nombre",
  puertas: Object.freeze({ local: "IA local", nube: "IA en la nube" } satisfies Record<Puerta, string>),
  cotejadas: "cifras calculadas por Inversiones y cotejadas",
  analisisDel: "Análisis de la IA del",
  calidad: Object.freeze({
    VERIFICADO: "verificado", NO_VERIFICADO: "sin verificar", ESTIMADO: "estimado", CALCULADO: "calculado por Inversiones", ATRASADO: "atrasado",
  } satisfies Record<Calidad, string>),
  vigencia: Object.freeze({
    AL_DIA: "Al día con los datos de este momento.",
    DESACTUALIZADO: "DESACTUALIZADO: los datos cambiaron desde este análisis.",
    SIN_COMPROBAR: "Sin comprobar contra los datos de este momento.",
  } satisfies Record<VigenciaResumenIa, string>),
  /** Por qué el validador rechazó un análisis, en palabras simples (la pantalla no muestra los códigos). */
  motivosRechazo: Object.freeze({
    SALIDA_INVALIDA: "la respuesta de la IA no tenía el formato esperado",
    LONGITUD: "el texto salió más largo o más corto de lo permitido",
    CIFRA_SUELTA: "traía una cifra que no estaba entre las calculadas",
    CIFRA_EN_PALABRAS: "escribió una cifra con letras en vez de usar las calculadas",
    HECHO_DESCONOCIDO: "citó un dato que no existe en la información entregada",
    HECHO_NO_CITADO: "no citó todas las cifras que debía",
    ETIQUETA_NO_COINCIDE: "nombró una cifra con otra etiqueta",
    DIRECCION_CONTRADICE: "dijo que algo subió o bajó al revés de lo que muestran los datos",
    RECOMENDACION: "usó un lenguaje de consejo, que el sistema no permite",
    PREDICCION: "habló del futuro como si fuera seguro, y el sistema no lo permite",
    TRATO: "usó un trato directo que no corresponde",
    IDIOMA: "mezcló palabras de otro idioma",
    FORMATO: "tenía un formato que no se puede mostrar",
    RENDER_CIFRA: "una cifra no se pudo escribir como corresponde",
    RANGO_CONTRADICE: "describió un punto con una palabra que no corresponde a su nivel",
    PARA_REVISAR: "la lista de puntos para revisar no tenía la forma esperada",
    ATRIBUCION: "atribuyó el cambio a una acción, y el sistema solo describe cómo queda",
  } satisfies Record<CodigoValidador, string>),
  /** Cuando el último intento de análisis falló (no hubo salida del modelo); `{cuando}` lleva la fecha y la hora. */
  fallo: Object.freeze({
    conAnterior: "El último intento de análisis ({cuando}) falló; se muestra el anterior.",
    conSinIa: "El último intento de análisis ({cuando}) falló; se muestra el resumen sin IA.",
    sinResumen: "El último intento de análisis ({cuando}) falló.",
  }),
  /** Cuando el análisis guardado ya no pasa el validador y no se muestra. */
  descartado: Object.freeze({
    conSinIa: "El análisis guardado ya no pasa la revisión; se muestra el resumen sin IA.",
    sinResumen: "El análisis guardado ya no pasa la revisión.",
  }),
  rechazoGeneral: "no cumplió las reglas de redacción",
  /** El botón «Analizar con IA» y lo que dice según cómo vaya el pedido. */
  boton: Object.freeze({
    etiqueta: "Analizar con IA",
    analizando: "Analizando…",
    enEspera: "En espera: hay otro análisis en curso y este empieza al terminar.",
    ocupado: "Ya hay un análisis en curso y otro en espera. Inténtelo cuando termine alguno.",
    apagado: "El análisis a demanda está apagado en la configuración de la IA.",
    tareaInactiva: "Este resumen está inactivo en la configuración de la IA.",
    sinServicio: "El servicio de análisis no responde. Inténtelo más tarde.",
    demasiado: "Aguarde unos segundos antes de volver a pedirlo.",
    error: "No se pudo pedir el análisis. Inténtelo de nuevo.",
    listo: "Análisis listo.",
    sigueEnCurso: "El análisis sigue en curso; recargue en unos minutos.",
    analisisError: "El análisis no se pudo completar. Inténtelo de nuevo.",
    analisisDescartado: "El análisis en espera no se hizo: la IA se apagó mientras esperaba.",
    sinEstado: "No se pudo consultar el estado del análisis; intente de nuevo.",
  }),
  notaSinDatos: "Hoy no hay resumen: faltan datos para armarlo.",
  notaMomento: "El resumen no está disponible en este momento. Al volver a cargar la página se intenta de nuevo.",
});

/** Un nombre de modelo que no tiene la forma de siempre (letras, dígitos, «.:_-/») no se repite en la pantalla. */
const MODELO = /^[A-Za-z0-9][A-Za-z0-9.:_/-]{0,63}$/;

export function pieConIa(puerta: Puerta, modelo: string): string {
  const nombre = MODELO.test(modelo) ? modelo : TEXTOS_RESUMEN_IA.modeloSinNombre;
  return `Redactado por ${TEXTOS_RESUMEN_IA.puertas[puerta]} (${nombre}) · ${TEXTOS_RESUMEN_IA.cotejadas}`;
}

/** «Puede volver a analizar en 1 min 15 s.»: cuándo se puede pedir otro análisis (el mínimo entre análisis es de 2 minutos). */
export function textoEspera(segundos: number): string {
  if (segundos <= 0) return "Puede volver a analizar ya.";
  if (segundos < 60) return `Puede volver a analizar en ${segundos} s.`;
  const resto = segundos % 60;
  return `Puede volver a analizar en ${Math.floor(segundos / 60)} min${resto === 0 ? "" : ` ${resto} s`}.`;
}

const esCodigoConocido = (codigo: string): codigo is CodigoValidador => Object.hasOwn(TEXTOS_RESUMEN_IA.motivosRechazo, codigo);

/** El motivo de un rechazo del validador en palabras simples; un código que no se conoce (o ninguno) dice la frase general. */
export function textoRechazo(cuando: string, motivos: readonly string[]): string {
  const frases = [...new Set(motivos.map((m) => (esCodigoConocido(m) ? TEXTOS_RESUMEN_IA.motivosRechazo[m] : TEXTOS_RESUMEN_IA.rechazoGeneral)))];
  const dichas = frases.length === 0 ? [TEXTOS_RESUMEN_IA.rechazoGeneral] : frases;
  return `El último análisis (${cuando}) no pasó la revisión automática y no se muestra: ${dichas.join("; ")}.`;
}
