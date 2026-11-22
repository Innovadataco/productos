/**
 * Camino ÚNICO de escritura de dividendo_decretado (fase C, C4a). Nada más en src/ ni en scripts/ crea ni retira un
 * decreto (candado tests/unit/datos-oficiales/decretos/camino-unico.test.ts).
 * - La base exige una sola versión vigente por clave (especie, anuncio, tipo, cuota) y que no se repita un número de
 *   versión; la CADENA la garantiza este módulo: `planificar` solo acepta versiones 1..n con la n como única vigente
 *   (si no, CADENA_ROTA: una v2 sin v1, un número que no sigue al anterior o un retiro sin sucesor), y un cambio retira
 *   la vigente e inserta la n+1 en la misma transacción. Anular es una versión nueva `anulada` con su nota (P10).
 * - Una sola transacción para todo el archivo: se toma el candado de REGISTRO_DECRETOS, se releen y se vuelven a
 *   planificar las versiones y, por cada cambio, se retira la vigente (debe contar 1), se guarda la fila cruda cifrada y
 *   se inserta la versión siguiente. Si algo falla, no queda nada (tampoco la carga). Sin cambios, no se escribe nada.
 * - Escribe en cualquier base: la condición de C1 (no cargar decretos reales hasta que el motor de proyecciones cruzara
 *   los decretos con los pagos de Trii por ventana) se cumplió en C5b (src/proyecciones/dividendos.ts con ventana.ts),
 *   que retiró la guarda de C4a (candado tests/unit/datos-oficiales/decretos/sin-guarda.test.ts).
 * - Después del candado consultivo, la transacción fija lock_timeout (10 s): con la tabla tomada por una migración no
 *   espera los 60 s; la espera de otra carga de decretos la acota el timeout de la transacción. El orden
 *   de lectura es dividendo_decretado y después fila_fuente; la migración de C1 toma fila_fuente primero: una migración
 *   futura que tome las dos debe correr con las cargas detenidas (si se cruzan, PostgreSQL aborta una; nada se corrompe).
 * - El nombre del archivo del dueño no se guarda (puede nombrar una especie): la carga dice NOMBRE_ARCHIVO; la identifica
 *   su sha256.
 */
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Llavero } from "../../cifrado/llavero";
import { diaIso } from "../../precios/horario";
import { crearCarga, guardarFilaCruda, tomarCandado, verFila } from "../registro/carga";
import type { Hallazgo } from "../registro/hallazgos";
import type { FilaDecreto } from "./csv";
import type { DecretoLeido, TipoDecreto } from "./filas";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

export const TIPO_FUENTE = "REGISTRO_DECRETOS" as const;
const TRANSACCION = { timeout: 60_000, maxWait: 10_000 } as const;
export const NOMBRE_ARCHIVO = "decretos.csv";

export type CodigoDecretos = "CADENA_ROTA" | "ANULACION_SIN_DECRETO" | "CONFLICTO_CONCURRENTE";

export class ErrorDecretos extends Error {
  constructor(readonly codigo: CodigoDecretos, readonly linea = 0) {
    super(codigo);
    this.name = "ErrorDecretos";
  }
}

/** Una versión guardada de un decreto, con lo que hace falta para planificar. */
export interface VersionGuardada {
  readonly id: string;
  readonly instrumentoId: string;
  readonly tipo: TipoDecreto;
  readonly fechaAnuncio: Date;
  readonly cuota: number;
  readonly version: number;
  readonly vigente: boolean;
  readonly valorPorAccion: Prisma.Decimal;
  readonly fechaEx: Date;
  readonly fechaPago: Date;
  readonly referenciaOficial: string;
  readonly nota: string | null;
  readonly anulada: boolean;
  readonly filaFuenteId: string;
}

/** Una fila del CSV con su especie ya resuelta a un instrumento. */
export interface DecretoResuelto {
  readonly fila: FilaDecreto;
  readonly instrumentoId: string;
}

export type Plan =
  | { readonly accion: "NUEVO"; readonly version: 1 }
  | { readonly accion: "NUEVA_VERSION"; readonly version: number; readonly retirarId: string }
  | { readonly accion: "SIN_CAMBIOS"; readonly filaFuenteId: string }
  | { readonly accion: "RECHAZO"; readonly codigo: "CADENA_ROTA" | "ANULACION_SIN_DECRETO" };

export interface Planificado {
  readonly resuelto: DecretoResuelto;
  readonly plan: Exclude<Plan, { readonly accion: "RECHAZO" }>;
}

export interface ConteosDecretos {
  readonly filas: number;
  readonly nuevos: number;
  readonly versiones: number;
  readonly anulaciones: number;
  readonly sinCambios: number;
}

export const claveDecreto = (instrumentoId: string, tipo: TipoDecreto, fechaAnuncio: Date, cuota: number): string =>
  `${instrumentoId}|${tipo}|${diaIso(fechaAnuncio)}|${cuota}`;

/**
 * La clave natural de la fila cruda de una versión: la clave del decreto (con el instrumento, no el texto: un alias de
 * Trii no crea otra) y el número de versión. Así el único de fila_fuente es espejo de la clave de versión, y volver al
 * contenido de la v1 en una v3 no choca con la fila de la v1.
 */
export function claveNaturalDecreto(instrumentoId: string, d: Pick<DecretoLeido, "tipo" | "fechaAnuncio" | "cuota">, version: number): string {
  return createHash("sha256").update(JSON.stringify([TIPO_FUENTE, instrumentoId, d.tipo, diaIso(d.fechaAnuncio), d.cuota, version])).digest("hex");
}

/** La vigente, si la cadena es 1..n sin huecos ni repetidos y la n es la única vigente; si no, null. */
function vigenteDeCadenaSana(versiones: readonly VersionGuardada[]): VersionGuardada | null {
  const orden = [...versiones].sort((a, b) => a.version - b.version);
  if (!orden.every((v, i) => v.version === i + 1)) return null;
  const vigentes = orden.filter((v) => v.vigente);
  const ultima = orden[orden.length - 1];
  return vigentes.length === 1 && vigentes[0] === ultima ? ultima : null;
}

/** Mismo contenido: valor (como decimal), fechas, referencia, nota y anulada. La clave ya es la misma. */
export function mismoContenido(v: VersionGuardada, d: DecretoLeido): boolean {
  return (
    v.valorPorAccion.equals(new Prisma.Decimal(d.valorPorAccion)) && v.fechaEx.getTime() === d.fechaEx.getTime() &&
    v.fechaPago.getTime() === d.fechaPago.getTime() && v.referenciaOficial === d.referencia && v.nota === d.nota && v.anulada === d.anulada
  );
}

/** Qué hacer con una fila, dadas TODAS las versiones guardadas de su clave. Puro. */
export function planificar(versiones: readonly VersionGuardada[], d: DecretoLeido): Plan {
  if (versiones.length === 0) return d.anulada ? { accion: "RECHAZO", codigo: "ANULACION_SIN_DECRETO" } : { accion: "NUEVO", version: 1 };
  const vigente = vigenteDeCadenaSana(versiones);
  if (!vigente) return { accion: "RECHAZO", codigo: "CADENA_ROTA" };
  if (mismoContenido(vigente, d)) return { accion: "SIN_CAMBIOS", filaFuenteId: vigente.filaFuenteId };
  return { accion: "NUEVA_VERSION", version: vigente.version + 1, retirarId: vigente.id };
}

export function planificarTodos(
  resueltos: readonly DecretoResuelto[], versiones: ReadonlyMap<string, readonly VersionGuardada[]>,
): { readonly planes: readonly Planificado[]; readonly hallazgos: readonly Hallazgo[] } {
  const planes: Planificado[] = [];
  const hallazgos: Hallazgo[] = [];
  for (const resuelto of resueltos) {
    const d = resuelto.fila.decreto;
    const plan = planificar(versiones.get(claveDecreto(resuelto.instrumentoId, d.tipo, d.fechaAnuncio, d.cuota)) ?? [], d);
    if (plan.accion === "RECHAZO") hallazgos.push({ linea: d.linea, columna: null, codigo: plan.codigo });
    else planes.push({ resuelto, plan });
  }
  return { planes, hallazgos };
}

export function contar(planes: readonly Planificado[]): ConteosDecretos {
  const de = (f: (p: Planificado) => boolean) => planes.filter(f).length;
  const anulacion = (p: Planificado) => p.plan.accion === "NUEVA_VERSION" && p.resuelto.fila.decreto.anulada;
  return {
    filas: planes.length,
    nuevos: de((p) => p.plan.accion === "NUEVO"),
    versiones: de((p) => p.plan.accion === "NUEVA_VERSION" && !anulacion(p)),
    anulaciones: de(anulacion),
    sinCambios: de((p) => p.plan.accion === "SIN_CAMBIOS"),
  };
}

export const hayCambios = (c: ConteosDecretos): boolean => c.nuevos + c.versiones + c.anulaciones > 0;

/** Todas las versiones (vigentes y retiradas) de los decretos de esos instrumentos, por clave. */
export async function leerVersiones(db: Db, instrumentoIds: readonly string[]): Promise<ReadonlyMap<string, readonly VersionGuardada[]>> {
  const filas = await db.dividendoDecretado.findMany({
    where: { instrumentoId: { in: [...new Set(instrumentoIds)] } },
    select: {
      id: true, instrumentoId: true, tipo: true, fechaAnuncio: true, cuota: true, version: true, reemplazadoEn: true, valorPorAccion: true,
      fechaEx: true, fechaPago: true, referenciaOficial: true, nota: true, anulada: true, filaFuenteId: true,
    },
    orderBy: [{ version: "asc" }, { id: "asc" }],
  });
  const porClave = new Map<string, VersionGuardada[]>();
  for (const { reemplazadoEn, tipo, ...f } of filas) {
    const v: VersionGuardada = { ...f, tipo: tipo as TipoDecreto, vigente: reemplazadoEn === null };
    const clave = claveDecreto(v.instrumentoId, v.tipo, v.fechaAnuncio, v.cuota);
    porClave.set(clave, [...(porClave.get(clave) ?? []), v]);
  }
  return porClave;
}

async function escribir(tx: Tx, cargaId: string, p: Planificado, llavero: Llavero): Promise<void> {
  const { fila, instrumentoId } = p.resuelto;
  const d = fila.decreto;
  if (p.plan.accion === "SIN_CAMBIOS") return verFila(tx, cargaId, d.linea, p.plan.filaFuenteId);
  if (p.plan.accion === "NUEVA_VERSION") {
    // Primero el retiro: el índice único de la vigente no se puede diferir. La base pone la hora (inv_solo_retiro).
    const { count } = await tx.dividendoDecretado.updateMany({ where: { id: p.plan.retirarId, reemplazadoEn: null }, data: { reemplazadoEn: new Date() } });
    if (count !== 1) throw new ErrorDecretos("CONFLICTO_CONCURRENTE", d.linea);
  }
  const claveNatural = claveNaturalDecreto(instrumentoId, d, p.plan.version);
  const filaFuenteId = await guardarFilaCruda(tx, { cargaId, tipoFuente: TIPO_FUENTE, claveNatural, filaNo: d.linea, crudo: fila.crudo }, llavero);
  await crearDecreto(tx, {
    filaFuenteId, instrumentoId, tipo: d.tipo, valorPorAccion: new Prisma.Decimal(d.valorPorAccion), fechaAnuncio: d.fechaAnuncio, cuota: d.cuota,
    fechaEx: d.fechaEx, fechaPago: d.fechaPago, moneda: "COP", referenciaOficial: d.referencia, nota: d.nota, version: p.plan.version, anulada: d.anulada,
  }, d.linea);
}

/**
 * Con el candado tomado, un P2002 aquí (la vigente o la versión ya existen) solo puede venir de un escritor fuera de
 * este camino: CONFLICTO_CONCURRENTE con su línea. Un P2002 en otra tabla (la fila cruda) sería un defecto propio y sube.
 */
async function crearDecreto(tx: Tx, data: Prisma.DividendoDecretadoUncheckedCreateInput, linea: number): Promise<void> {
  try {
    await tx.dividendoDecretado.create({ data, select: { id: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ErrorDecretos("CONFLICTO_CONCURRENTE", linea);
    throw error;
  }
}

export interface EntradaGuardar {
  readonly usuarioId: string;
  readonly sha256: string;
  readonly resueltos: readonly DecretoResuelto[];
  readonly llavero: Llavero;
}

export type ResultadoGuardar =
  | { readonly estado: "APLICADO"; readonly cargaId: string; readonly conteos: ConteosDecretos }
  | { readonly estado: "SIN_CAMBIOS"; readonly conteos: ConteosDecretos }
  | { readonly estado: "RECHAZADO"; readonly hallazgos: readonly Hallazgo[] };

async function enTransaccion(tx: Tx, e: EntradaGuardar): Promise<ResultadoGuardar> {
  // Primero el candado consultivo, sin lock_timeout (que también lo cortaría): otra carga de decretos puede tardar más
  // de 10 s (2.000 cambios, unos 21 s); esa espera la acota el timeout de la transacción. Después, lo más que se espera
  // por un candado de tabla (una migración) son 10 s.
  await tomarCandado(tx, TIPO_FUENTE);
  await tx.$executeRaw`SET LOCAL lock_timeout = '10s'`;
  const versiones = await leerVersiones(tx, e.resueltos.map((r) => r.instrumentoId));
  const { planes, hallazgos } = planificarTodos(e.resueltos, versiones);
  if (hallazgos.length > 0) return { estado: "RECHAZADO", hallazgos };
  const conteos = contar(planes);
  if (!hayCambios(conteos)) return { estado: "SIN_CAMBIOS", conteos };
  const cargaId = await crearCarga(tx, {
    tipoFuente: TIPO_FUENTE, nombreArchivo: NOMBRE_ARCHIVO, sha256: e.sha256, usuarioId: e.usuarioId,
    filasTotal: conteos.filas, filasNuevas: conteos.filas - conteos.sinCambios, filasRepetidas: conteos.sinCambios,
  });
  for (const p of planes) await escribir(tx, cargaId, p, e.llavero);
  return { estado: "APLICADO", cargaId, conteos };
}

/**
 * Aplica las filas ya leídas y resueltas. Los rechazos (CADENA_ROTA, ANULACION_SIN_DECRETO y CONFLICTO_CONCURRENTE)
 * vuelven como RECHAZADO sin haber escrito nada; cualquier otro error sube (puede haber ocurrido al confirmar).
 */
export async function guardarDecretos(db: PrismaClient, e: EntradaGuardar): Promise<ResultadoGuardar> {
  try {
    return await db.$transaction((tx) => enTransaccion(tx, e), TRANSACCION);
  } catch (error) {
    if (error instanceof ErrorDecretos) return { estado: "RECHAZADO", hallazgos: [{ linea: error.linea, columna: null, codigo: error.codigo }] };
    throw error;
  }
}
