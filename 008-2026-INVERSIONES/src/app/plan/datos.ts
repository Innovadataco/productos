/**
 * Qué muestra /plan, según las versiones cargadas y el `?version=` pedido. Solo lectura.
 * La versión del query se acepta solo si es, tal cual, el número de una versión cargada: la que se lee es la que vino
 * de la base (el texto del query no se repite en la pantalla). Sin query, la vigente hoy (o, si todavía no rige
 * ninguna, la primera programada). Los cierres y la referencia del tablero se leen solo para la vigente.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { calendarioBvc, leerReglas, leerVersiones, ultimosCierres } from "@/plan/lectura";
import { fechaEnBogota } from "@/precios/horario";
import { obtenerResumen } from "@/tablero/datos";
import { versionDeConsulta } from "../_plan/consulta";
import type { DatosPlan } from "../_plan/tipos";
import { aVersionVista, aVistaPlan, vigenteEn, type Cierres } from "./vista";

export async function datosDelPlan(db: PrismaClient, pedido: string | string[] | undefined): Promise<DatosPlan> {
  const versiones = await leerVersiones(db);
  if (versiones.length === 0) return { estado: "SIN_PLAN" };
  const ahora = new Date();
  const hoy = fechaEnBogota(ahora);
  const vigente = vigenteEn(versiones, hoy);
  const numero = pedido === undefined ? null : versionDeConsulta(pedido);
  const elegida = pedido === undefined ? (vigente ?? [...versiones].sort((a, b) => a.version - b.version)[0]!) : versiones.find((v) => v.version === numero);
  if (!elegida) return { estado: "VERSION_INVALIDA", versiones: versiones.map((v) => aVersionVista(v, vigente, null, hoy)) };
  const reglas = await leerReglas(db, elegida.id);
  const cierres = elegida.id === vigente?.id ? await leerCierres(db, reglas.flatMap((r) => (r.instrumentoId === null ? [] : [r.instrumentoId]))) : null;
  return {
    estado: "VERSION",
    vista: aVistaPlan({ versiones, elegida, reglas, cierres, hoy, ahora }),
    versiones: versiones.map((v) => aVersionVista(v, vigente, elegida, hoy)),
  };
}

async function leerCierres(db: PrismaClient, especies: readonly string[]): Promise<Cierres> {
  const [porEspecie, calendario, resumen] = await Promise.all([ultimosCierres(db, especies), calendarioBvc(db), obtenerResumen(db)]);
  return { porEspecie, calendario, referencia: resumen.tablero.fechaReferencia };
}
