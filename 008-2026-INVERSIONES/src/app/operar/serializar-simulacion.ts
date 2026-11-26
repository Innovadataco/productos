/**
 * La simulación del motor (src/operar/simulador) como texto para la pantalla: pesos exactos con `textoPesos`, pesos
 * porcentuales a 2 decimales (mitad hacia arriba, solo para mostrar: el motor no redondea), cantidades con miles y los
 * textos del simulador (comisión, reglas, avisos y errores). Puro.
 */
import { Prisma } from "@prisma/client";
import { cantidadEs } from "@/plan/edicion/formato";
import { DECIMALES_PESO, porcentajeEs } from "@/operar/analisis/texto";
import { textoAfectacion, textoAviso, textoPesos, textoComision, textoError, textoPesosRedondos, textoRegla, NOTA_CAJA_SIN_COMISION, NOTA_VALORACION } from "@/operar/simulador/textos";
import type { ComisionEstimada, PosicionSimulada, ResultadoSimulacion, Tenencia } from "@/operar/simulador/tipos";
import type { VistaAnalisisSimulacion } from "@/operar/analisis/vista";
import { fecha } from "../tablero/formato";
import type { EspecieSimulable, FuenteComision, RespuestaSimulacion } from "./tipos-simulador";

export const SIN_CIERRE = "sin cierre";
export const SIN_PESO = "—";
export const CAJA_ESCRITA = "Caja de la simulación: el saldo que usted escribió, no la de Acciones & Valores (no se guarda).";
export const CAJA_SIN_CERTIFICACION = "Sin certificación de Acciones & Valores: la caja de antes es 0. Escriba su saldo en Trii en «Su saldo disponible en el comisionista» para simular con él.";
export const AVISO_CAJA_AV_NEGATIVA = "La caja certificada por Acciones & Valores es negativa y no es su saldo en Trii: escríbalo en «Su saldo disponible en el comisionista» para simular con él.";
export const NOTA_VALORACION_CON_PRECIO = "Es el precio de la especie operada; las demás se valoran a su último cierre y la caja se mueve al precio límite de la orden.";
/** «Valorado con el precio escrito: $ 2.345,5 (trii Pro), no con el cierre del 12-mar-2027.» */
export function textoPrecioEscrito(precio: Prisma.Decimal, cierreFecha: Date | null): string {
  const base = `Valorado con el precio escrito: ${textoPesos(precio)} (trii Pro)`;
  return cierreFecha === null ? `${base}; la especie no tiene cierre guardado.` : `${base}, no con el cierre del ${fecha(cierreFecha.toISOString().slice(0, 10))}.`;
}
export const textoCajaCertificada = (dia: string): string => `Caja certificada por Acciones & Valores al ${fecha(dia)}; no es su saldo en Trii. Escríbalo en «Su saldo disponible en el comisionista» para simular con él.`;

const FUENTES: Readonly<Record<ComisionEstimada["estado"], FuenteComision>> = { TARIFA: "TARIFA", ESTIMADA: "HISTORIA", SIN_HISTORIA: "SIN_HISTORIA" };

/** «12,34 %», «12,30 %» (siempre dos decimales, como todo peso de /operar), «sin cierre» o «—» si el valor de las acciones es 0. */
export function textoPeso(t: Tenencia): string {
  if (t.valoracion.estado === "SIN_CIERRE") return SIN_CIERRE;
  const p = t.valoracion.pesoPct;
  return p === null ? SIN_PESO : `${porcentajeEs(p.toDecimalPlaces(DECIMALES_PESO, Prisma.Decimal.ROUND_HALF_UP).toFixed(DECIMALES_PESO))} %`;
}

export const especiesSimulables = (posiciones: readonly PosicionSimulada[]): EspecieSimulable[] =>
  posiciones.map((p) => ({ id: p.instrumentoId, nemotecnico: p.nemotecnico, cantidad: cantidadEs(p.cantidad) }));

/** La respuesta de la ruta: la vista o los errores del dueño, ya como texto. `cajaAl` es el corte de la caja (null sin certificación; «ESCRITA» si la escribió el dueño). */
/** El precio actual escrito para la especie operada y el día del último cierre con que se habría valorado (null si no tiene). */
export interface PrecioEscrito {
  readonly precio: Prisma.Decimal;
  readonly cierreFecha: Date | null;
}

export function aRespuestaSimulacion(
  r: ResultadoSimulacion,
  instrumentoId: string,
  posiciones: readonly PosicionSimulada[],
  cajaAl: Date | null | "ESCRITA",
  analisis: VistaAnalisisSimulacion | null = null,
  precioEscrito: PrecioEscrito | null = null,
): RespuestaSimulacion {
  if (!r.ok) return { ok: false, errores: r.errores.map(textoError) };
  const s = r.simulacion;
  const operada = posiciones.find((p) => p.instrumentoId === instrumentoId)?.nemotecnico ?? "";
  const conComision = s.comision.estado !== "SIN_HISTORIA";
  return {
    ok: true,
    vista: {
      especies: s.especies.map((e) => ({
        nemotecnico: e.nemotecnico,
        operada: e.instrumentoId === instrumentoId,
        cantidadAntes: cantidadEs(e.antes.cantidad),
        cantidadDespues: cantidadEs(e.despues.cantidad),
        pesoAntes: textoPeso(e.antes),
        pesoDespues: textoPeso(e.despues),
      })),
      valorOrden: textoPesosRedondos(s.valorOrden),
      comision: { fuente: FUENTES[s.comision.estado], valor: conComision ? textoPesosRedondos(s.comision.valor) : null, texto: textoComision(s.comision) },
      cajaAntes: textoPesosRedondos(s.cajaAntes),
      cajaDespues: textoPesosRedondos(s.cajaDespues),
      cajaFuente: cajaAl === "ESCRITA" ? CAJA_ESCRITA : cajaAl === null ? CAJA_SIN_CERTIFICACION : textoCajaCertificada(cajaAl.toISOString().slice(0, 10)),
      valorAccionesAntes: textoPesosRedondos(s.valorAccionesAntes),
      valorAccionesDespues: textoPesosRedondos(s.valorAccionesDespues),
      reglas: s.reglasAfectadas.map((a) => ({ texto: textoRegla(a.regla, operada), afectaciones: a.afectaciones.map((x) => textoAfectacion(x, a.regla)) })),
      avisos: [...(cajaAl !== "ESCRITA" && s.cajaAntes.isNeg() && !s.cajaAntes.isZero() ? [AVISO_CAJA_AV_NEGATIVA] : []), ...s.avisos.map(textoAviso)],
      notas: [...(precioEscrito === null ? [NOTA_VALORACION] : [textoPrecioEscrito(precioEscrito.precio, precioEscrito.cierreFecha), NOTA_VALORACION_CON_PRECIO]), ...(conComision ? [] : [NOTA_CAJA_SIN_COMISION])],
      analisis,
    },
  };
}
