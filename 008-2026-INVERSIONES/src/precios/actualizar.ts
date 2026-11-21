/**
 * Guarda los cierres de Yahoo de las especies con posición (INV-SPEC-13): elige las especies, les pide a Yahoo
 * sus cierres (`<NEMO>.CL` o el símbolo registrado) y los guarda por el camino ÚNICO de escritura
 * (`guardar.ts`: versión con guarda, omisiones de SPEC-13 y re-verificación contra la certificación).
 * Un error de la base al buscar el símbolo o de Yahoo queda en esa especie: no escribe nada de ella y se informa.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { FUENTE, guardarCierresDeEspecies, type ResultadoActualizacion } from "./guardar";
import { obtenerCierres, type Buscar } from "./yahoo";

// Lo que otros módulos y las pruebas importan de aquí desde antes de que existiera guardar.ts.
export {
  DESVIACION_PCT_MAXIMA, FUENTE, MAX_INTENTOS_GUARDADO, TOLERANCIA_VERIFICACION, detalleDeError, leerCalendarioBvc, mismaVerificacion, retirarVigentes,
  type FalloEspecie, type ResultadoActualizacion, type Verificacion,
} from "./guardar";

/** Símbolo de Yahoo vigente en la fecha, o `<NEMO>.CL` si no hay equivalencia registrada. */
export async function simboloDe(db: PrismaClient, instrumentoId: string, nemotecnico: string, hoy: Date): Promise<string> {
  const mapa = await db.simboloPrecio.findFirst({
    where: { instrumentoId, proveedor: FUENTE, vigenteDesde: { lte: hoy }, OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: hoy } }] },
    select: { simbolo: true },
  });
  return mapa?.simbolo ?? `${nemotecnico}.CL`;
}

/**
 * Las especies a las que se les guardan cierres: acciones activas con nemotécnico; sin `instrumentoIds`, las que
 * tienen lotes (las de `precios:actualizar` por defecto, y también las de `precios:importar`).
 */
export function dondeEspecies(instrumentoIds?: readonly string[]): Prisma.InstrumentoWhereInput {
  return { tipo: "ACCION", activo: true, nemotecnico: { not: null }, ...(instrumentoIds ? { id: { in: [...instrumentoIds] } } : { lotes: { some: {} } }) };
}

interface OpcionesActualizacion {
  readonly desde: Date;
  readonly hasta: Date;
  readonly buscar: Buscar;
  readonly instrumentoIds?: readonly string[];
  readonly ahora?: Date;
}

export async function actualizarPrecios(db: PrismaClient, opciones: OpcionesActualizacion): Promise<ResultadoActualizacion> {
  const especies = await db.instrumento.findMany({ where: dondeEspecies(opciones.instrumentoIds), select: { id: true, nemotecnico: true } });
  const ahora = opciones.ahora ?? new Date();
  const fuentes = especies.map((e) => ({
    instrumentoId: e.id,
    traer: async () => obtenerCierres(await simboloDe(db, e.id, e.nemotecnico!, opciones.hasta), opciones.desde, opciones.hasta, opciones.buscar),
  }));
  return guardarCierresDeEspecies(db, fuentes, { desde: opciones.desde, hasta: opciones.hasta, ahora });
}
