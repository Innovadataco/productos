/**
 * Lo que imprime scripts/registrar-movimiento-fondo.ts (frente fondo-movimientos): ids internos y códigos, nunca las
 * cifras, el correo ni el código del fondo (son datos reales). Cada rechazo dice su código y qué revisar; si el
 * contraste con el valor de unidad falla, qué mirar en el extracto: el día y el valor de unidad (decisión de la Fábrica:
 * se niega siempre, sin opción para seguir). Nunca recomienda comprar ni vender.
 */
import type { CodigoRechazo, ResultadoConstitucion } from "./movimiento";

const QUE_REVISAR: Readonly<Record<CodigoRechazo, string>> = {
  USUARIO_NO_AUTORIZADO: "el correo no es el de un dueño activo.",
  FONDO_NO_REGISTRADO: "ese código no es un fondo (FIC) registrado: regístrelo primero (registrar-fondo).",
  FONDO_INACTIVO: "el fondo está inactivo.",
  CONSTITUCION_DISTINTA:
    "el fondo ya tiene una constitución con otro día, otras unidades u otro monto. No se cambia: la corrección será un ajuste aparte.",
  MOVIMIENTO_ANTES_DE_LA_CONSTITUCION: "el fondo ya tiene movimientos anteriores a ese día: revise en el extracto el día de la constitución.",
  SIN_VALOR_UNIDAD_DEL_DIA:
    "falta el valor de unidad de la SFC de ese día (nunca se usa el de otro día): revise en el extracto el día de la constitución y cargue los valores del fondo desde ese día.",
  MONTO_NO_CUADRA_CON_VALOR_UNIDAD:
    "el monto no es unidades × valor de unidad de la SFC de ese día (±0,5 %): revise en el extracto el día y el valor de unidad con que se asignaron las unidades.",
  REGISTRO_EN_CONFLICTO: "otro registro del mismo fondo chocó con este: vuelva a intentarlo.",
};

export function textoRechazo(codigo: CodigoRechazo): string {
  return `❌ No se registró: ${codigo} · ${QUE_REVISAR[codigo]}`;
}

export function textoResultado(r: ResultadoConstitucion): string {
  switch (r.estado) {
    case "ENSAYO":
      return `🔎 Ensayo: la constitución del fondo ${r.fondoId} cuadra con el valor de unidad de la SFC de ese día. No se escribió nada: para registrarla, repita con --aplicar.`;
    case "REGISTRADA":
      return `✅ Constitución del fondo registrada (fondo ${r.fondoId} · movimiento ${r.movimientoId} · ajuste de caja ${r.ajusteId}). Siguiente paso: conciliar-certificacion --fecha-corte <corte>.`;
    case "YA_EXISTIA":
      return `✅ La constitución del fondo ${r.fondoId} ya estaba registrada con esos datos (movimiento ${r.movimientoId}): no se escribió nada.`;
  }
}
