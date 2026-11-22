import "server-only";
/**
 * Lectura de las series oficiales de valor_serie_oficial (fase C, C5a), para la pantalla (C6a) y la fase D. Solo lee
 * (el camino único de escritura es guardar.ts) y solo VIGENTES (reemplazadoEn nulo): una vigencia retirada es historia
 * y nunca se entrega. Cada fila sale como CifraOficial OFICIAL: valor canónico, unidad del catálogo, su vigencia, su
 * fuente y cuándo se trajo, para que quien la muestre diga siempre de cuándo es.
 * - `ultimoValor(hoy)`: el último que YA empezó (desde ≤ hoy). La TRM se publica por adelantado: la del fin de semana,
 *   cargada el viernes, no se entrega como la del viernes. Si hay un hueco, entrega el último con SU vigencia: la
 *   frescura (frescura.ts) dice si está atrasado y si cubre hoy.
 * - `valorVigenteEn(fecha)`: el que cubre esa fecha, o null. Nunca el anterior: un día sin vigente no tiene valor.
 * - `serieEnRango(desde, hasta)`: las vigentes que se solapan con el rango (la primera puede empezar antes), en orden.
 * - `estadoSerie(hoy)`: el último y su frescura con UN mismo hoy (lo que usará la pantalla; code-reviewer, MEDIO).
 * Consultas (las mide tests/integracion/series-leer-rendimiento.test.ts): las tres van por el índice único parcial
 * (serie, desde) de los vigentes. Las dos primeras son una sola sonda (desde ≤ fecha, la más reciente, LIMIT 1): como
 * los vigentes no se solapan (la exclusión de la base), solo esa puede cubrir la fecha, y el `hasta` se mira aquí, así
 * la consulta nunca recorre la historia. El rango se acota por abajo con desde ≥ desde − MAX_DIAS_TRAS_DESDE_LECTURA
 * (la vigencia más larga que admite la base) y su take es días + 1: sin solapes, a lo sumo una fila por día; más es
 * DEMASIADAS_FILAS, nunca un recorte en silencio.
 * Una serie fuera del catálogo o una fecha que no es un día (medianoche UTC; `hoy` es fechaEnBogota de
 * src/precios/horario.ts) o que cae fuera de DIA_MINIMO_LECTURA_MS…DIA_MAXIMO_LECTURA_MS es un error tipado y no consulta la
 * base. `catalogo` se inyecta solo en las pruebas.
 * `db` puede ser el cliente o una transacción. Quien combine varias lecturas (C6a: la base y el final de una variación)
 * debe hacerlo en UNA transacción REPEATABLE READ de solo lectura (enSoloLectura de src/conciliacion/leer.ts): guardar.ts
 * retira e inserta en una transacción, y con READ COMMITTED dos sentencias podrían ver estados distintos
 * (database-reviewer, BAJO).
 * Las fechas viajan como Date de medianoche UTC y la base las compara como días: verificado con la sesión de la base de
 * pruebas en America/Bogota (los bordes de tests/integracion/series-leer.test.ts). La zona de la base de producción: POR
 * VERIFICAR (database-reviewer, BAJO).
 */
import type { Prisma } from "@prisma/client";
import { CATALOGO, type SerieCatalogo } from "../catalogo";
import { esFechaDeNegocio, MS_POR_DIA, sumarDias } from "../../plan/fechas";
import { aValorOficial, ErrorLecturaSeries, type CifraOficial } from "./consulta";
import { frescura, type Frescura } from "./frescura";

/** El cliente de Prisma o una transacción. */
export type LectorSeries = Prisma.TransactionClient;

/**
 * El desde más viejo que todavía puede tocar un rango: la base exige hasta ≤ desde + 31 (valor_serie_oficial_vigencia_chk).
 * Candado: tests/unit/datos-oficiales/series-lectura-candados.test.ts lo compara con la migración.
 */
export const MAX_DIAS_TRAS_DESDE_LECTURA = 31;
/** El rango más largo que se lee de una vez: 40 años (a lo sumo una fila por día: 14 640 filas). */
export const MAX_DIAS_RANGO_SERIES = 40 * 366;
/**
 * La ventana de fechas que se aceptan (los dos extremos incluidos). Una fecha absurda pero válida como Date (el año
 * 275760) llegaría a Prisma y su error saldría sin tipar (security-reviewer, BAJO). El CSV de series ya exige 19AA o 20AA.
 */
export const DIA_MINIMO_LECTURA_MS = Date.UTC(1902, 0, 1);
export const DIA_MAXIMO_LECTURA_MS = Date.UTC(2199, 11, 31);

const SELECCION = { desde: true, hasta: true, valor: true, fuente: true, traidoEn: true } as const satisfies Prisma.ValorSerieOficialSelect;

interface FilaLeida {
  readonly desde: Date;
  readonly hasta: Date;
  readonly valor: Prisma.Decimal;
  readonly fuente: string;
  readonly traidoEn: Date;
}

function serieConocida(codigo: string, catalogo: readonly SerieCatalogo[]): SerieCatalogo {
  const serie = catalogo.find((s) => s.codigo === codigo);
  if (!serie) throw new ErrorLecturaSeries("SERIE_DESCONOCIDA");
  return serie;
}

function exigirDia(fecha: Date): void {
  const dentro = esFechaDeNegocio(fecha) && fecha.getTime() >= DIA_MINIMO_LECTURA_MS && fecha.getTime() <= DIA_MAXIMO_LECTURA_MS;
  if (!dentro) throw new ErrorLecturaSeries("FECHA_INVALIDA");
}

/**
 * La fila como cifra OFICIAL, congelada y con sus propias fechas (no las de la fila). Un valor que la base no debería
 * tener (cero, negativo, exponente) nunca se muestra.
 */
function aCifra(serie: SerieCatalogo, fila: FilaLeida): CifraOficial {
  const valor = aValorOficial(fila.valor.toFixed());
  if (valor === null) throw new ErrorLecturaSeries("VALOR_INVALIDO");
  return Object.freeze({
    serie: serie.codigo, valor, unidad: serie.unidad,
    desde: new Date(fila.desde.getTime()), hasta: new Date(fila.hasta.getTime()), fuente: fila.fuente, traidoEn: new Date(fila.traidoEn.getTime()),
    origen: "OFICIAL" as const,
  });
}

/** El vigente con el mayor desde ≤ fecha: una sonda del índice único parcial (serie, desde), LIMIT 1. */
function ultimoQueEmpieza(db: LectorSeries, serie: string, fecha: Date): Promise<FilaLeida | null> {
  return db.valorSerieOficial.findFirst({ where: { serie, reemplazadoEn: null, desde: { lte: fecha } }, orderBy: { desde: "desc" }, select: SELECCION });
}

/** El último vigente que ya empezó a `hoy` (desde ≤ hoy), o null si no hay. */
export async function ultimoValor(db: LectorSeries, codigo: string, hoy: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): Promise<CifraOficial | null> {
  const serie = serieConocida(codigo, catalogo);
  exigirDia(hoy);
  const fila = await ultimoQueEmpieza(db, serie.codigo, hoy);
  return fila === null ? null : aCifra(serie, fila);
}

/** El vigente que cubre `fecha` (desde ≤ fecha ≤ hasta), o null: nunca el anterior. */
export async function valorVigenteEn(db: LectorSeries, codigo: string, fecha: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): Promise<CifraOficial | null> {
  const serie = serieConocida(codigo, catalogo);
  exigirDia(fecha);
  const fila = await ultimoQueEmpieza(db, serie.codigo, fecha);
  return fila !== null && fila.hasta.getTime() >= fecha.getTime() ? aCifra(serie, fila) : null;
}

export interface EstadoSerie {
  readonly ultimo: CifraOficial | null;
  readonly frescura: Frescura;
}

/** El último vigente que ya empezó y su frescura, con el MISMO hoy (una consulta). */
export async function estadoSerie(db: LectorSeries, codigo: string, hoy: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): Promise<EstadoSerie> {
  const ultimo = await ultimoValor(db, codigo, hoy, catalogo);
  return Object.freeze({ ultimo, frescura: frescura(codigo, ultimo, hoy, catalogo) });
}

/** Las vigentes que se solapan con [desde, hasta] (los dos incluidos), ordenadas por desde. */
export async function serieEnRango(db: LectorSeries, codigo: string, desde: Date, hasta: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): Promise<readonly CifraOficial[]> {
  const serie = serieConocida(codigo, catalogo);
  exigirDia(desde);
  exigirDia(hasta);
  if (desde.getTime() > hasta.getTime()) throw new ErrorLecturaSeries("RANGO_INVALIDO");
  const dias = (hasta.getTime() - desde.getTime()) / MS_POR_DIA + 1;
  if (dias > MAX_DIAS_RANGO_SERIES) throw new ErrorLecturaSeries("RANGO_DEMASIADO_LARGO");
  const filas = await db.valorSerieOficial.findMany({
    where: { serie: serie.codigo, reemplazadoEn: null, desde: { gte: sumarDias(desde, -MAX_DIAS_TRAS_DESDE_LECTURA), lte: hasta }, hasta: { gte: desde } },
    orderBy: { desde: "asc" },
    take: dias + 1,
    select: SELECCION,
  });
  if (filas.length > dias) throw new ErrorLecturaSeries("DEMASIADAS_FILAS");
  return Object.freeze(filas.map((f) => aCifra(serie, f)));
}
