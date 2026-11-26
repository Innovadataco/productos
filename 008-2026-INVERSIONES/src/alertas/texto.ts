/**
 * El texto de cada alerta lo escribe el código, no un modelo (puro). Informa lo que pasó con el precio y de dónde sale; no
 * recomienda comprar ni vender (candado: tests/unit/alertas/lenguaje.candado.test.ts). Dice la hora de la barra en hora de
 * Colombia y el retraso de Yahoo, nunca «ahora».
 */
import type { Prisma } from "@prisma/client";
import { diaIso } from "../precios/horario";
import type { Alerta } from "./tipos";
import { RETRASO_YAHOO_MIN } from "./evaluar/frescura";

const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;
const dos = (n: number): string => String(n).padStart(2, "0");

/** HH:MM en hora de Colombia (UTC−5, sin horario de verano). */
function horaCot(instante: Date): string {
  const l = new Date(instante.getTime() - DESFASE_BOGOTA_MS);
  return `${dos(l.getUTCHours())}:${dos(l.getUTCMinutes())}`;
}
const num = (d: Prisma.Decimal | undefined): string => (d === undefined ? "?" : d.toString().replace(".", ","));
const pct = (d: Prisma.Decimal | undefined): string => (d === undefined ? "?" : `${d.abs().toString().replace(".", ",")} %`);

/** De dónde sale el precio: la barra con su hora y su retraso, o el cierre del día. */
function origen(a: Alerta): string {
  if (a.base === "CIERRE") return "cierre del día";
  const { instante, conRetraso } = a.datos;
  const hora = instante === undefined ? "la última barra intradía" : `la barra de las ${horaCot(instante)} (hora de Colombia)`;
  return conRetraso ? `precio de ${hora}, con el retraso de unos ${RETRASO_YAHOO_MIN} minutos de Yahoo` : `precio de ${hora}`;
}

const lado = (a: Alerta): string => (a.sentido === "BAJO" ? "por debajo" : "por encima");

function textoNivel(a: Alerta, e: string): string {
  const { nivel, precio, distanciaPct } = a.datos;
  const base = `${e}: ${origen(a)} (${num(precio)})`;
  if (a.tipo === "NIVEL_CRUZADO") return `${base} quedó ${lado(a)} del nivel de su regla (${num(nivel)}).`;
  if (distanciaPct === undefined) return `${base} está en el nivel de su regla (${num(nivel)}).`;
  return `${base} está a ${pct(distanciaPct)} del nivel de su regla (${num(nivel)}).`;
}

function textoMovimiento(a: Alerta, e: string): string {
  const { precio, variacionPct, esFechaEx } = a.datos;
  const principal = `${e}: ${origen(a)} (${num(precio)}) está ${pct(variacionPct)} ${lado(a)} del cierre anterior.`;
  return esFechaEx ? `${principal} Hoy es la fecha ex de un dividendo de la especie.` : principal;
}

function textoCaida(a: Alerta): string {
  const fuente = a.base === "CIERRE" ? "con los cierres del día" : `con los últimos precios de las barras intradía (pueden traer el retraso de unos ${RETRASO_YAHOO_MIN} minutos de Yahoo)`;
  return `El valor del portafolio, ${fuente}, bajó ${pct(a.datos.variacionPct)} frente al cierre anterior.`;
}

function textoDatoViejo(a: Alerta, e: string): string {
  if (a.base === "CIERRE") return `${e}: falta el cierre de hoy.`;
  const { instante, minutosDeEdad, umbralMin } = a.datos;
  const desde = instante === undefined ? "no hay ninguna barra de hoy" : `la última barra es de las ${horaCot(instante)} (hora de Colombia)`;
  return `${e}: ${desde}; lleva ${minutosDeEdad ?? "?"} minutos, por encima del límite de ${umbralMin ?? "?"} (incluye el retraso de unos ${RETRASO_YAHOO_MIN} minutos de Yahoo).`;
}

function textoFechaEx(a: Alerta, e: string): string {
  const { fechaEx, fechaPago, esFechaEx } = a.datos;
  const cuando = esFechaEx ? "es hoy" : `es el ${fechaEx === undefined ? "?" : diaIso(fechaEx)}`;
  const pago = fechaPago === undefined ? "" : ` El pago está previsto para el ${diaIso(fechaPago)}.`;
  return `${e}: la fecha ex del decreto ${cuando}.${pago}`;
}

/** `etiqueta` es el nemotécnico (o el nombre) de la especie; la alerta del portafolio no la usa. */
export function textoDeAlerta(a: Alerta, etiqueta: string): string {
  switch (a.tipo) {
    case "NIVEL_CRUZADO":
    case "NIVEL_CERCA": return textoNivel(a, etiqueta);
    case "MOVIMIENTO_DIA": return textoMovimiento(a, etiqueta);
    case "CAIDA_PORTAFOLIO": return textoCaida(a);
    case "DATO_VIEJO": return textoDatoViejo(a, etiqueta);
    case "FECHA_EX": return textoFechaEx(a, etiqueta);
  }
}
