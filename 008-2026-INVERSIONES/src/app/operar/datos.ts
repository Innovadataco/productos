import "server-only";
/**
 * Lo que lee /operar (frente operar-informe). Solo lectura: reusa los lectores de las otras pantallas, sin cambiarlos.
 * - Los próximos ex-dividendos (`leerProximos`, en su transacción de solo lectura) van primero y solos: así no compiten
 *   por el pool de conexiones con el resto.
 * - Después, en paralelo, el resumen del tablero (`obtenerResumen`, con `calcularTablero`), las versiones del plan y el
 *   calendario de la BVC; la versión que rige hoy (`vigenteEn`, la regla de /plan), sus reglas y el último cierre de
 *   cada especie de las reglas (`ultimosCierres`, la fuente de /plan).
 * - No hay una foto común: una carga que confirme entre dos lecturas puede dejar la referencia del tablero y el cierre
 *   de una regla de momentos distintos (como en /plan). Con el criterio de «al día» (cierre ≥ referencia) eso nunca
 *   vuelve «al día» un cierre viejo; al recargar, cuadra.
 * Un fallo de la base se propaga: la página lo muestra como «No se pudo leer la base».
 */
import type { PrismaClient } from "@prisma/client";
import { leerProximos } from "@/datos-oficiales/decretos/leer";
import { armarInforme } from "@/operar/informe/armar";
import type { EntradasInforme } from "@/operar/informe/tipos";
import { calendarioBvc, leerReglas, leerVersiones, ultimosCierres } from "@/plan/lectura";
import { obtenerResumen } from "@/tablero/datos";
import { vigenteEn } from "../plan/vista";
import { especiesSimulables } from "./serializar-simulacion";
import { aVistaOperar } from "./serializar";
import type { VistaOperar } from "./tipos";

/** Las entradas del armador con el día de Colombia `hoy` (medianoche UTC). */
export async function leerEntradas(db: PrismaClient, hoy: Date): Promise<EntradasInforme> {
  const proximos = await leerProximos(db, hoy);
  const [resumen, versiones, calendario] = await Promise.all([obtenerResumen(db), leerVersiones(db), calendarioBvc(db)]);
  const vigente = vigenteEn(versiones, hoy);
  const reglas = vigente ? await leerReglas(db, vigente.id) : [];
  const cierresDeReglas = await ultimosCierres(db, reglas.flatMap((r) => (r.instrumentoId === null ? [] : [r.instrumentoId])));
  return {
    tablero: resumen.tablero,
    incompletas: resumen.incompletas,
    calendario,
    plan: vigente ? { numero: vigente.version, vigenteDesde: vigente.vigenteDesde, reglas } : null,
    cierresDeReglas,
    proximos,
  };
}

/** El informe y las especies del simulador «¿Y si…?» (las filas del tablero que ya se leyeron, vivas y cerradas). */
export async function datosDeOperar(db: PrismaClient, hoy: Date): Promise<VistaOperar> {
  const entradas = await leerEntradas(db, hoy);
  const especies = especiesSimulables([...entradas.tablero.filas, ...entradas.tablero.cerradas]);
  return { ...aVistaOperar(armarInforme(entradas, hoy)), especies };
}
