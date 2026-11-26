import "server-only";
/**
 * Lo que lee /analisis (frente analisis-pantalla, A2). Solo lectura: reusa los lectores de las otras pantallas, sin
 * cambiarlos, y el motor puro src/analisis/ calcula (aquí no se calcula nada a mano).
 * - El tablero (`obtenerResumen`, con `calcularTablero`) y las versiones del plan, en paralelo; después la historia
 *   (`leerEntradas`, la de /proyecciones, en su transacción de solo lectura), el diario (`leerDiario`, con los resultados
 *   de `resultadosDeDecisiones`, también en la suya) y las reglas de la versión que rige hoy (`vigenteEn`, la de /plan).
 * - El fondo FIC: su valor sale de la misma historia (`fondosDeHistoria`); el tablero no lo lee. De su valor de unidad
 *   se lee además la fuente y cuándo lo trajo 008, para la fecha del dato.
 * - El aviso de dato viejo de los cierres de acciones (frente fuente-retraso) sale de `procedencias.ts`; el del fondo, no.
 * - No hay una foto común: una carga que confirme entre dos lecturas puede dejar el tablero y la historia de momentos
 *   distintos; al recargar, cuadra. Si el motor rechaza las entradas (RangeError), el error se propaga a error.tsx.
 * Un fallo de la base se propaga: la página lo muestra como «No se pudo leer la base».
 */
import type { PrismaClient } from "@prisma/client";
import { analizar } from "@/analisis/analizar";
import { fondosDeHistoria } from "@/analisis/fondo";
import { observaciones } from "@/analisis/observaciones";
import type { FondoParaAnalisis, ReglaParaAnalisis } from "@/analisis/tipos";
import { leerDiario, leerReglas, leerVersiones } from "@/plan/lectura";
import { diaIso } from "@/precios/horario";
import { leerEntradas } from "@/proyecciones/leer";
import type { EntradasProyeccion } from "@/proyecciones/tipos";
import type { Tablero } from "@/tablero/calculo";
import { obtenerResumen } from "@/tablero/datos";
import { horaColombia } from "../_comun/fecha-dato/hora";
import type { Procedencia } from "../_comun/fecha-dato/tipos";
import { vigenteEn } from "../plan/vista";
import { calendarioConRespaldo } from "../_comun/calendario-con-respaldo";
import { procedenciasDeCierres } from "./procedencias";
import { aVistaAnalisis, type VistaAnalisis } from "./vista";

/** La procedencia del valor de unidad de cada fondo, el del día con que se valoró. */
async function procedenciasDeFondos(db: PrismaClient, fondos: readonly FondoParaAnalisis[]): Promise<ReadonlyMap<string, Procedencia>> {
  const filas = await Promise.all(
    fondos.map((f) =>
      db.valorUnidadFondo.findFirst({
        where: { fondoId: f.instrumentoId, fechaValor: f.dia, reemplazadoEn: null },
        select: { fuente: true, traidoEn: true },
        orderBy: [{ traidoEn: "desc" }, { id: "desc" }],
      }),
    ),
  );
  return new Map(fondos.map((f, k) => [f.instrumentoId, { dia: diaIso(f.dia), traidoEn: filas[k] ? horaColombia(filas[k]!.traidoEn) : null, fuente: filas[k]?.fuente ?? null }]));
}

function nombresDe(tablero: Tablero, historia: EntradasProyeccion): ReadonlyMap<string, string> {
  const especies = [...tablero.filas, ...tablero.cerradas].map((f) => [f.instrumentoId, f.nemotecnico] as const);
  const fondos = historia.posiciones.flatMap((p) => (p.tipo === "FONDO" ? [[p.instrumentoId, p.nombre] as const] : []));
  return new Map([...fondos, ...especies]);
}

/** De una regla, solo lo que el motor mide: ni la acción, ni la cantidad, ni el texto libre. */
const paraAnalisis = (r: ReglaParaAnalisis): ReglaParaAnalisis => ({ id: r.id, instrumentoId: r.instrumentoId, condicion: r.condicion, nivel: r.nivel, plazoHasta: r.plazoHasta });

/**
 * La vista de /analisis con el día de Colombia `hoy` (medianoche UTC). `ahora` es el instante con que se sacó `hoy`: con el
 * calendario de la BVC cuenta los días hábiles de atraso de cada cierre (si el calendario no se lee, el aviso es aproximado).
 */
export async function datosDeAnalisis(db: PrismaClient, hoy: Date, ahora: Date = new Date()): Promise<VistaAnalisis> {
  const [resumen, versiones, calendario] = await Promise.all([obtenerResumen(db), leerVersiones(db), calendarioConRespaldo(db, "analisis")]);
  const historia = await leerEntradas(db, hoy);
  const diario = await leerDiario(db, hoy, null);
  const vigente = vigenteEn(versiones, hoy);
  const reglas = vigente ? await leerReglas(db, vigente.id) : [];
  const fondos = fondosDeHistoria(historia);
  const analisis = analizar({ hoy, historia, tablero: resumen.tablero, decisiones: [...diario.resultados.values()], fondos: fondos.fondos });
  return aVistaAnalisis({
    analisis,
    observaciones: observaciones(analisis, { reglas: reglas.map(paraAnalisis) }, hoy),
    nombres: nombresDe(resumen.tablero, historia),
    procedencias: { acciones: procedenciasDeCierres(resumen.tablero, { ahora, calendario }), fondos: await procedenciasDeFondos(db, fondos.fondos) },
    diarioTruncado: diario.truncado,
    fondosSinValor: fondos.sinValor,
  });
}
