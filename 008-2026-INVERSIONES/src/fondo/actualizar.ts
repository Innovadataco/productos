/**
 * Guarda el valor de unidad diario de los fondos (FIC) activos desde la SFC (qhpu-8ixx): elige los fondos, le pide a
 * la SFC los valores de su clase y los guarda por el camino ÚNICO de escritura (`guardar.ts`: versionado, lotes,
 * reintento ante otra corrida y último dato de cada fondo).
 * - La clase sale de `SimboloPrecio` (proveedor `sfc:qhpu-8ixx`) vigente a la fecha `hasta`.
 * - Un error de la base al leer la clase queda en ese fondo (BASE_ERROR): no escribe nada de él y se informa.
 */
import type { PrismaClient } from "@prisma/client";
import { claseVigente } from "./clase";
import { dondeFondos, guardarValoresDeFondos, type ResultadoFondo } from "./guardar";
import { obtenerValores, type BuscarSfc } from "./sfc";

// Lo que otros módulos y las pruebas importan de aquí desde antes de que existiera guardar.ts.
export { DIAS_ATRASO_AVISO, MAX_INTENTOS, TAMANO_LOTE, type FalloFondo, type ResultadoFondo, type UltimoValor } from "./guardar";

export interface OpcionesActualizacion {
  readonly desde: Date;
  readonly hasta: Date;
  readonly buscar: BuscarSfc;
  readonly instrumentoIds?: readonly string[];
}

export async function actualizarFondo(db: PrismaClient, opciones: OpcionesActualizacion): Promise<ResultadoFondo> {
  const fondos = await db.instrumento.findMany({ where: dondeFondos(opciones.instrumentoIds), select: { id: true, codigoFic: true }, orderBy: { id: "asc" } });
  const fuentes = fondos.map((f) => ({
    instrumentoId: f.id,
    traer: async () => obtenerValores({ codigo: f.codigoFic!, participacion: await claseVigente(db, f.id, opciones.hasta), desde: opciones.desde, hasta: opciones.hasta }, opciones.buscar),
  }));
  return guardarValoresDeFondos(db, fuentes, { hasta: opciones.hasta });
}
