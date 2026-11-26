/**
 * Una corrida de las alertas: lee la entrada, evalúa (motor puro), guarda y resume. El reloj entra por `ahora` y el
 * interruptor del intradía por `intradiaActivo` (los pone scripts/evaluar-alertas.ts desde la configuración). El resumen es
 * solo de conteos: nunca nemotécnicos, ids ni precios (va al registro del servicio).
 * Salida: 0 = evaluó y guardó (con o sin alertas nuevas) · 3 = alguna alerta no se pudo guardar (las demás quedaron).
 * Un error de lectura o de la base se propaga: el script lo convierte en 1.
 */
import { evaluarAlertas } from "./evaluar";
import { guardarAlertas, type ResultadoGuardado } from "./guardar";
import { leerEntrada, type LectorAlertas } from "./leer-entrada";
import type { PrismaClient } from "@prisma/client";

export interface OpcionesCorrida {
  readonly ahora: Date;
  readonly intradiaActivo: boolean;
}

export interface ResultadoCorrida {
  readonly resultado: ResultadoGuardado;
  readonly lineas: readonly string[];
  readonly codigoSalida: 0 | 3;
}

export function lineasDeResultado(r: ResultadoGuardado): string[] {
  const lineas = [`alertas: evaluadas ${r.evaluadas} · nuevas ${r.insertadas} · ya guardadas ${r.duplicadas} · fallidas ${r.fallidas}`];
  if (r.fallidas > 0) lineas.push("alertas: alguna alerta no se pudo guardar; revise el registro de la base");
  return lineas;
}

export async function correrAlertas(db: LectorAlertas & Pick<PrismaClient, "alerta">, opciones: OpcionesCorrida): Promise<ResultadoCorrida> {
  const leida = await leerEntrada(db, opciones.ahora, opciones.intradiaActivo);
  const alertas = evaluarAlertas(leida.entrada);
  const resultado = await guardarAlertas(db, alertas, { umbrales: leida.entrada.umbrales, umbralVersionId: leida.umbralVersionId, procedencia: leida.procedencia });
  return { resultado, lineas: lineasDeResultado(resultado), codigoSalida: resultado.fallidas > 0 ? 3 : 0 };
}
