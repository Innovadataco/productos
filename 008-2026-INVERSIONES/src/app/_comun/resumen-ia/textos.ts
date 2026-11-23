/**
 * Los textos fijos de la tarjeta de resumen (E5). Describen, no aconsejan: los revisa el candado de lenguaje
 * (tests/unit/resumen-ia/tarjeta.test.ts, con `prohibidasEn`). El aviso de cada tipo no está aquí: lo pone el validador.
 */
import type { Calidad, TipoResumen } from "@/ia/contrato";
import type { Puerta } from "@/ia/generador";
import type { VigenciaResumenIa } from "./tipos";

export const TEXTOS_RESUMEN_IA = Object.freeze({
  titulos: Object.freeze({ DIARIO: "Resumen del día", REGLAS: "Resumen de las reglas", ESCENARIOS: "Resumen de los escenarios" } satisfies Record<TipoResumen, string>),
  eyebrow: "En dos líneas",
  cifrasUsadas: "Cifras usadas",
  redactadoEn: "Redactado el",
  sinIa: "Resumen sin IA",
  noDisponible: "Sin resumen",
  modeloSinNombre: "modelo sin nombre",
  puertas: Object.freeze({ local: "IA local", nube: "IA en la nube" } satisfies Record<Puerta, string>),
  cotejadas: "cifras calculadas por 008 y cotejadas",
  calidad: Object.freeze({
    VERIFICADO: "verificado", NO_VERIFICADO: "sin verificar", ESTIMADO: "estimado", CALCULADO: "calculado por 008", ATRASADO: "atrasado",
  } satisfies Record<Calidad, string>),
  vigencia: Object.freeze({
    AL_DIA: "Al día con los datos de este momento.",
    DESACTUALIZADO: "DESACTUALIZADO: los datos de hoy cambiaron después de redactarlo.",
    SIN_COMPROBAR: "Sin comprobar contra los datos de este momento.",
  } satisfies Record<VigenciaResumenIa, string>),
  notaSinDatos: "Hoy no hay resumen: faltan datos para armarlo.",
  notaMomento: "El resumen no está disponible en este momento. Al volver a cargar la página se intenta de nuevo.",
});

/** Un nombre de modelo que no tiene la forma de siempre (letras, dígitos, «.:_-/») no se repite en la pantalla. */
const MODELO = /^[A-Za-z0-9][A-Za-z0-9.:_/-]{0,63}$/;

export function pieConIa(puerta: Puerta, modelo: string): string {
  const nombre = MODELO.test(modelo) ? modelo : TEXTOS_RESUMEN_IA.modeloSinNombre;
  return `Redactado por ${TEXTOS_RESUMEN_IA.puertas[puerta]} (${nombre}) · ${TEXTOS_RESUMEN_IA.cotejadas}`;
}
