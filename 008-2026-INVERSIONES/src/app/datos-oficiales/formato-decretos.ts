/**
 * Textos y formatos de la sección de dividendos decretados de /datos-oficiales (frente datos-oficiales-decretos-pantalla,
 * C6b). Puro y determinista. Solo lo usa la pantalla del servidor (Decretos.tsx): nunca lo importa lo del navegador
 * (candado tests/unit/pantalla-datos-oficiales/frontera.test.ts).
 * - Los pesos salen del TEXTO decimal, exactos: miles con punto, decimales con coma, al menos 2 y nunca redondeados ni
 *   truncados (el bruto de C5b es exacto a la millonésima). El signo va delante del «$».
 * - Cada estado y cada motivo del cruce de C5b (src/datos-oficiales/decretos/cruce.ts) tiene su texto: un estado o un
 *   motivo nuevo no compila sin el suyo.
 * - La diferencia se llama «diferencia bruto − neto»: no se le da otro nombre mientras el extracto no diga qué es.
 * - Nada aquí recomienda comprar ni vender, ni muestra comandos: la pantalla la ve la familia
 *   (tests/unit/pantalla-datos-oficiales/textos.test.ts).
 */
import type { TipoDividendo } from "@prisma/client";
import type { EstadoCruce, MotivoRevisar } from "@/datos-oficiales/decretos/cruce";
import { VENTANA_PAGO_ANTES_DIAS, VENTANA_PAGO_DESPUES_DIAS } from "@/datos-oficiales/decretos/ventana";
import { SIN_DATO, cifra } from "./formato";

const MENOS = "−";
const ENTERO = /^-?\d+$/;
/** Los montos en pesos llevan al menos los centavos. */
const ESCALA_PESOS = 2;

/** «$ 5.308,871247», «$ 1.200,00», «−$ 137,10»; sin dato o con un texto que no es decimal, «—». */
export function pesos(valor: string | null): string {
  if (valor === null) return SIN_DATO;
  const texto = cifra(valor, ESCALA_PESOS);
  if (texto === SIN_DATO) return SIN_DATO;
  return texto.startsWith(MENOS) ? `${MENOS}$ ${texto.slice(MENOS.length)}` : `$ ${texto}`;
}

/** «1.237 acciones», «1 acción», «−10 acciones» (una tenencia negativa se muestra: faltan órdenes cargadas). */
export function acciones(tenencia: string): string {
  if (!ENTERO.test(tenencia)) return SIN_DATO;
  const unidad = tenencia.replace(/^-/, "") === "1" ? "acción" : "acciones";
  return `${cifra(tenencia, 0)} ${unidad}`;
}

export const TEXTO_TIPO: Readonly<Record<TipoDividendo, string>> = { ORDINARIO: "Ordinario", EXTRAORDINARIO: "Extraordinario", FRACCION_ESCISION: "Fracción de escisión" };

/** «Ordinario · cuota 2». */
export const tipoYCuota = (tipo: TipoDividendo, cuota: number): string => `${TEXTO_TIPO[tipo]} · cuota ${cuota}`;

/** Para el lector de pantalla: «ordinario cuota 2». */
export const tipoYCuotaEnFrase = (tipo: TipoDividendo, cuota: number): string => `${TEXTO_TIPO[tipo].toLowerCase()} cuota ${cuota}`;

export const TEXTO_ESTADO_CRUCE: Readonly<Record<EstadoCruce, string>> = {
  RECIBIDO: "Recibido", PENDIENTE: "Pendiente", NO_RECIBIDO: "No recibido", SIN_DECRETO: "Sin decreto", REVISAR: "Revisar",
};

/** Por qué un grupo quedó en ese estado; REVISAR dice sus motivos (TEXTO_MOTIVO). */
export const EXPLICACION_ESTADO: Readonly<Record<Exclude<EstadoCruce, "REVISAR">, string>> = {
  RECIBIDO: "Trii pagó dentro de la ventana de pago.",
  PENDIENTE: "La ventana de pago no ha terminado o las cargas de Trii todavía no la cubren.",
  NO_RECIBIDO: "Terminó la ventana de pago y las cargas de Trii la cubren, sin un pago.",
  SIN_DECRETO: "Un pago de Trii sin un decreto registrado en su ventana.",
};

export const TEXTO_MOTIVO: Readonly<Record<MotivoRevisar, string>> = {
  DECRETO_REPETIDO: "Hay dos decretos del mismo tipo y cuota (con otro anuncio): el bruto saldría doble.",
  TENENCIA_NEGATIVA: "La tenencia antes de la ex sale negativa: faltan órdenes cargadas.",
  PAGO_SIN_TENENCIA: "Llegó un pago sin acciones de la especie antes de la ex.",
  NETO_MAYOR_QUE_BRUTO: "El neto de Trii es mayor que el bruto esperado.",
  PAGO_ANTES_DE_LA_EX: "Un pago llegó antes de la fecha ex.",
  PAGO_EN_DISPUTA: "Pago en disputa: también cabe en la ventana de otro decreto de la especie, y a cuál corresponde es una suposición.",
  CARGA_NO_CUBRE_LA_EX: "Las cargas de Trii no llegan hasta la ex: la tenencia puede estar incompleta.",
};

export const NOTA_BRUTO =
  "El bruto es una estimación: el valor por acción por la tenencia, por fecha de operación, al cierre del día anterior a la ex " +
  "(si la ex todavía no llega, la tenencia de hoy, que puede cambiar). La regla del periodo ex y la fecha en que acredita Trii están por verificar.";

export const NOTA_DIFERENCIA = "Diferencia bruto − neto: el bruto esperado menos el neto de Trii. Qué la explica está por verificar con el extracto.";

export const notaVentana = (): string =>
  `Un pago de Trii cuenta para un decreto si llega entre ${VENTANA_PAGO_ANTES_DIAS} días antes y ${VENTANA_PAGO_DESPUES_DIAS} días después de su fecha de pago.`;

/** Los decretos con ex pasada que no esperaban pago (C5b: sinTenencia), contados por decreto. */
export function sinTenencia(n: number): string {
  return n === 1
    ? "1 decreto con fecha ex pasada no esperaba pago: no había acciones de la especie antes de la ex."
    : `${n} decretos con fecha ex pasada no esperaban pago: no había acciones de la especie antes de la ex.`;
}
