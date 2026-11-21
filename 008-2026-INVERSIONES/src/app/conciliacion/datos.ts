/**
 * Qué muestra /conciliacion, según los cortes cargados y el `?corte=` pedido. Solo lectura.
 * El corte del query se acepta solo si es, tal cual, uno de los cortes cargados: la fecha que se lee es la que
 * vino de la base, nunca una construida con el texto del query (que tampoco se repite en la pantalla).
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { cortesDisponibles, leerConciliacion } from "@/conciliacion/leer";
import { aCortes, aVistaCorte } from "./serializar";
import type { CorteVista, VistaCorte } from "./tipos";

export type DatosConciliacion =
  | { readonly estado: "SIN_CERTIFICACION" }
  | { readonly estado: "CORTE_INVALIDO"; readonly cortes: readonly CorteVista[] }
  | { readonly estado: "CORTE"; readonly vista: VistaCorte; readonly cortes: readonly CorteVista[] };

const dia = (d: Date): string => d.toISOString().slice(0, 10);

export async function datosDeConciliacion(db: PrismaClient, pedido: string | string[] | undefined): Promise<DatosConciliacion> {
  const cortes = await cortesDisponibles(db);
  if (cortes.length === 0) return { estado: "SIN_CERTIFICACION" };
  const elegido = pedido === undefined ? cortes[0] : typeof pedido === "string" ? cortes.find((c) => dia(c.fechaCorte) === pedido) : undefined;
  if (elegido === undefined) return { estado: "CORTE_INVALIDO", cortes: aCortes(cortes, null) };
  const lectura = await leerConciliacion(db, elegido.fechaCorte);
  if (lectura === null) return { estado: "CORTE_INVALIDO", cortes: aCortes(cortes, null) };
  return { estado: "CORTE", vista: aVistaCorte(lectura), cortes: aCortes(cortes, dia(elegido.fechaCorte)) };
}
