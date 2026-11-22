/**
 * El export de hechos del portafolio para la evaluación (E7): los tres paquetes (DIARIO, REGLAS y ESCENARIOS) armados
 * con los armadores de E1b desde los lectores de siempre, TODO dentro de una foto de solo lectura (foto.ts). No escribe
 * en la base ni en disco; quien lo llama (scripts/exportar-hechos-ia.ts) imprime el JSON por stdout.
 * Un tipo que no se puede armar (sin plan vigente, sin cierres, la proyección no corre…) queda en `omitidos` con su
 * código; los demás salen igual. Un error de la base no se traga: se propaga.
 * Rol: el del migrador por ahora; se pasa a `inv_ia` cuando exista en producción.
 */
import type { PrismaClient } from "@prisma/client";
import type { PaqueteHechos, TipoResumen } from "../../contrato";
import { armarDiario, armarEscenarios, armarReglas, ErrorArmado } from "../../hechos";
import { ErrorPaquete } from "../../paquete";
import { ultimaConciliacion } from "../../../conciliacion/leer";
import { calendarioBvc } from "../../../plan/lectura";
import { obtenerResumen } from "../../../tablero/datos";
import { fondoParaHechos } from "./fondo";
import { enFotoDeSoloLectura } from "./foto";
import { leerEntradaReglas, leerProyeccion, leerSeries } from "./lecturas";

export interface Omitido {
  readonly tipo: TipoResumen;
  readonly codigo: string;
}

export interface ResultadoExportacion {
  readonly paquetes: readonly PaqueteHechos[];
  readonly omitidos: readonly Omitido[];
  /** Lo que se dejó fuera de un paquete sin omitirlo (series ilegibles, fondos varios…), como códigos. */
  readonly avisos: readonly string[];
}

class Omision extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
  }
}

/** El paquete, o su omisión con el código del armador o del paquete; lo demás (la base) se propaga. */
async function intentar(tipo: TipoResumen, armar: () => Promise<PaqueteHechos>): Promise<PaqueteHechos | Omitido> {
  try {
    return await armar();
  } catch (error) {
    if (error instanceof ErrorArmado || error instanceof ErrorPaquete || error instanceof Omision) return Object.freeze({ tipo, codigo: error.codigo });
    throw error;
  }
}

const esOmitido = (x: PaqueteHechos | Omitido): x is Omitido => !("hash" in x);

/** `hoy`: la fecha de negocio en Colombia (medianoche UTC). */
export function exportarHechos(db: PrismaClient, hoy: Date): Promise<ResultadoExportacion> {
  const hoyIso = hoy.toISOString().slice(0, 10);
  return enFotoDeSoloLectura(db, async (c) => {
    const resumen = await obtenerResumen(c);
    const calendario = await calendarioBvc(c);
    const proyeccion = await leerProyeccion(c, hoy);
    const fondo = fondoParaHechos(proyeccion.entradas, proyeccion.resultado, hoy);
    const series = await leerSeries(c, hoy);
    const conciliacion = await ultimaConciliacion(c);
    const resultados = [
      await intentar("DIARIO", async () => armarDiario({ hoy: hoyIso, calendario, tablero: resumen.tablero, movimiento: resumen.movimiento, conciliacion, series: series.series, fondo: fondo.fondo })),
      await intentar("REGLAS", async () => {
        const entrada = await leerEntradaReglas(c, hoy, hoyIso, resumen, calendario);
        if (entrada === null) throw new Omision("SIN_PLAN_VIGENTE");
        return armarReglas(entrada);
      }),
      await intentar("ESCENARIOS", async () => {
        if (proyeccion.resultado === null) throw new Omision(proyeccion.codigo ?? "SIN_PROYECCION");
        return armarEscenarios({ hoy: hoyIso, resultado: proyeccion.resultado });
      }),
    ];
    const avisos = [...series.ilegibles.map((s) => `SERIE_ILEGIBLE_${s}`), ...(fondo.aviso === null ? [] : [fondo.aviso])];
    return Object.freeze({
      paquetes: Object.freeze(resultados.filter((r): r is PaqueteHechos => !esOmitido(r))),
      omitidos: Object.freeze(resultados.filter(esOmitido)),
      avisos: Object.freeze(avisos),
    });
  });
}
