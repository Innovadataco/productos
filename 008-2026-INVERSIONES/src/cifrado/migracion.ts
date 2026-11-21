/**
 * Migración de datos del #11: cifra lo que quedó en claro antes del cifrado y, con `reCifrar`, pasa a la
 * versión activa los sobres de otra versión (rotación de la clave). La usa scripts/cifrar-existentes.ts.
 *
 * - Ensayo por defecto: lee y cuenta, no escribe. Escribir exige nombrar la base conectada.
 * - Por lotes (cursor por llave primaria), una transacción por lote con un candado consultivo propio:
 *   dos corridas a la vez no se pisan.
 * - fila_fuente es de solo inserción (disparador `inv_solo_insercion`). Esta es la ÚNICA ruta del código
 *   que abre su bypass: `SET LOCAL inv.reversion = 'on'`, dentro de la transacción del lote y solo si ese
 *   lote tiene algo que escribir. SET LOCAL muere con la transacción. Solo se actualiza la columna `crudo`.
 * - Idempotente: un sobre de la versión activa no se vuelve a cifrar. Lo anómalo, los sobres cuya clave
 *   no está cargada y los que no abren con la clave cargada de su versión no se tocan: solo se cuentan.
 * - Cada sobre de una versión cargada se intenta abrir (también en el ensayo): así una clave equivocada con
 *   el nombre correcto (por ejemplo, la de un respaldo restaurado) se ve antes de escribir nada.
 * - Antes de escribir, cada valor nuevo se descifra y se compara con el original (ida y vuelta).
 * - Comparar y reemplazar: el UPDATE lleva en el WHERE el valor leído. Si otro lo cambió entre la lectura
 *   y la escritura, no se pisa: se cuenta en `concurrentes` y el script sale con 1.
 * - Se corre con los importadores detenidos y dos veces: la segunda debe dar 0 cambios.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { ErrorArgumentos, LOTE_MAXIMO, LOTE_POR_DEFECTO } from "./argumentos";
import {
  clasificarCrudo, clasificarEncargo, cifrarCrudo, cifrarEncargo, descifrarCrudo, descifrarEncargo,
  type ClaseCampo, type Crudo, type LlaveCertificacionFondo, type LlaveFilaFuente,
} from "./campos";
import { ErrorCifrado } from "./errores";
import { obtenerLlavero, type Llavero } from "./llavero";
import type { Sobre } from "./sobre";

const CANDADO = "inv008-cifrar-existentes";
const TRANSACCION = { timeout: 120_000, maxWait: 10_000 } as const;

export interface OpcionesMigracion {
  readonly aplicar: boolean;
  readonly reCifrar: boolean;
  readonly base?: string;
  readonly lote?: number;
  readonly llavero?: Llavero;
}

/** Conteos de una tabla, del estado leído en esta corrida (antes de sus escrituras). */
export interface ConteoTabla {
  readonly total: number;
  readonly enClaro: number;
  readonly anomalas: number;
  readonly porVersion: Readonly<Record<string, number>>;
  readonly sinClave: number;
  /** Sobres de una versión cargada que no autentican con esa clave (clave equivocada o sobre dañado). */
  readonly noAbren: number;
  /** Valores que otro cambió entre la lectura y la escritura de esta corrida: no se pisaron. */
  readonly concurrentes: number;
  readonly cifradasAhora: number;
  readonly reCifradasAhora: number;
}

export interface ResultadoMigracion {
  readonly base: string;
  readonly activa: string;
  readonly escribe: boolean;
  readonly filaFuente: ConteoTabla;
  readonly certificacionFondo: ConteoTabla;
}

export type CodigoMigracion = "BASE_NO_COINCIDE" | "VERIFICACION_FALLIDA" | "LOTE_INVALIDO";

const MENSAJES: Readonly<Record<CodigoMigracion, string>> = {
  BASE_NO_COINCIDE: "Para escribir, --base debe ser el nombre de la base conectada (DATABASE_URL).",
  VERIFICACION_FALLIDA: "La ida y vuelta de un valor recién cifrado no devolvió el original: no se escribió ese lote.",
  LOTE_INVALIDO: `El lote debe ser un entero entre 1 y ${LOTE_MAXIMO}.`,
};

export class ErrorMigracion extends Error {
  constructor(readonly codigo: CodigoMigracion) {
    super(MENSAJES[codigo]);
    this.name = "ErrorMigracion";
  }
}

type Tx = Prisma.TransactionClient;
type Modo = Pick<OpcionesMigracion, "aplicar" | "reCifrar">;
type Conteo = { -readonly [K in keyof ConteoTabla]: K extends "porVersion" ? Record<string, number> : number };

/** Cómo se lee, se clasifica, se cifra y se escribe un campo cifrado. P = el valor en claro. */
interface Campo<F, P> {
  leer(tx: Tx, despuesDe: F | undefined, lote: number): Promise<F[]>;
  clasificar(fila: F): ClaseCampo;
  kid(fila: F): string;
  plano(fila: F): P;
  descifrar(fila: F): P;
  /** Cifra con la versión activa, verifica la ida y vuelta y escribe solo si el valor sigue igual al leído. */
  reescribir(tx: Tx, fila: F, plano: P): Promise<boolean>;
  /** Solo fila_fuente: su disparador de solo inserción exige el bypass para actualizar. */
  readonly abreBypass: boolean;
}

function verificar<P>(vuelta: P, original: P): void {
  if (!isDeepStrictEqual(vuelta, original)) throw new ErrorMigracion("VERIFICACION_FALLIDA");
}

/** El valor en claro del sobre, o null si no abre con la clave cargada de su versión. */
function abrir<F, P>(campo: Campo<F, P>, fila: F): P | null {
  try {
    return campo.descifrar(fila);
  } catch (e) {
    if (e instanceof ErrorCifrado && (e.codigo === "AUTENTICACION_FALLIDA" || e.codigo === "CONTENIDO_INVALIDO")) return null;
    throw e;
  }
}

type Cambio<F, P> = { readonly fila: F; readonly plano: P; readonly accion: "cifradasAhora" | "reCifradasAhora" };

/** Decide qué hacer con una fila: null (no se toca) o el valor en claro que hay que (re)cifrar. */
function decidir<F, P>(campo: Campo<F, P>, fila: F, llavero: Llavero, modo: Modo, conteo: Conteo): Cambio<F, P> | null {
  conteo.total += 1;
  const clase = campo.clasificar(fila);
  if (clase === "anomalo") {
    conteo.anomalas += 1;
    return null;
  }
  if (clase === "claro") {
    conteo.enClaro += 1;
    return modo.aplicar ? { fila, plano: campo.plano(fila), accion: "cifradasAhora" } : null;
  }
  const kid = campo.kid(fila);
  conteo.porVersion[kid] = (conteo.porVersion[kid] ?? 0) + 1;
  if (!llavero.claves.has(kid)) {
    conteo.sinClave += 1;
    return null;
  }
  const plano = abrir(campo, fila);
  if (plano === null) {
    conteo.noAbren += 1;
    return null;
  }
  if (!modo.reCifrar || kid === llavero.activa) return null;
  return { fila, plano, accion: "reCifradasAhora" };
}

async function migrarTabla<F, P>(db: PrismaClient, campo: Campo<F, P>, llavero: Llavero, modo: Modo, lote: number): Promise<ConteoTabla> {
  const conteo: Conteo = { total: 0, enClaro: 0, anomalas: 0, porVersion: {}, sinClave: 0, noAbren: 0, concurrentes: 0, cifradasAhora: 0, reCifradasAhora: 0 };
  let ultima: F | undefined;
  for (;;) {
    const leidas: F[] = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CANDADO}))`;
      const filas = await campo.leer(tx, ultima, lote);
      const cambios = filas.flatMap((fila) => {
        const cambio = decidir(campo, fila, llavero, modo, conteo);
        return cambio === null ? [] : [cambio];
      });
      if (cambios.length > 0 && campo.abreBypass) await tx.$executeRaw`SET LOCAL inv.reversion = 'on'`;
      for (const { fila, plano, accion } of cambios) {
        const escrito = await campo.reescribir(tx, fila, plano);
        conteo[escrito ? accion : "concurrentes"] += 1;
      }
      return filas;
    }, TRANSACCION);
    if (leidas.length < lote) return { ...conteo, porVersion: { ...conteo.porVersion } };
    ultima = leidas[leidas.length - 1];
  }
}

type FilaFuenteLeida = LlaveFilaFuente & { readonly id: string; readonly crudo: Prisma.JsonValue };

function campoCrudo(llavero: Llavero): Campo<FilaFuenteLeida, Crudo> {
  return {
    abreBypass: true,
    leer: (tx, despuesDe, lote) =>
      tx.filaFuente.findMany({
        where: despuesDe ? { id: { gt: despuesDe.id } } : undefined,
        orderBy: { id: "asc" },
        take: lote,
        select: { id: true, tipoFuente: true, claveNatural: true, ocurrencia: true, crudo: true },
      }),
    clasificar: (f) => clasificarCrudo(f.crudo),
    kid: (f) => (f.crudo as Sobre).kid,
    plano: (f) => f.crudo as Crudo,
    descifrar: (f) => descifrarCrudo(f.crudo, f, llavero),
    async reescribir(tx, f, plano) {
      const sobre = cifrarCrudo(plano, f, llavero);
      verificar(descifrarCrudo(sobre, f, llavero), plano);
      const { count } = await tx.filaFuente.updateMany({
        where: { id: f.id, crudo: { equals: f.crudo as Prisma.InputJsonValue } },
        data: { crudo: sobre },
      });
      return count === 1;
    },
  };
}

type FondoLeido = LlaveCertificacionFondo & { readonly encargo: string };

function campoEncargo(llavero: Llavero): Campo<FondoLeido, string> {
  return {
    abreBypass: false,
    leer: (tx, despuesDe, lote) =>
      tx.certificacionFondo.findMany({
        ...(despuesDe ? { cursor: { certificacionId_instrumentoId: { certificacionId: despuesDe.certificacionId, instrumentoId: despuesDe.instrumentoId } }, skip: 1 } : {}),
        orderBy: [{ certificacionId: "asc" }, { instrumentoId: "asc" }],
        take: lote,
        select: { certificacionId: true, instrumentoId: true, encargo: true },
      }),
    clasificar: (f) => clasificarEncargo(f.encargo),
    kid: (f) => (JSON.parse(f.encargo) as Sobre).kid,
    plano: (f) => f.encargo,
    descifrar: (f) => descifrarEncargo(f.encargo, f, llavero),
    async reescribir(tx, f, plano) {
      const encargo = cifrarEncargo(plano, f, llavero);
      verificar(descifrarEncargo(encargo, f, llavero), plano);
      const { count } = await tx.certificacionFondo.updateMany({
        where: { certificacionId: f.certificacionId, instrumentoId: f.instrumentoId, encargo: f.encargo },
        data: { encargo },
      });
      return count === 1;
    },
  };
}

export async function cifrarExistentes(db: PrismaClient, opciones: OpcionesMigracion): Promise<ResultadoMigracion> {
  const llavero = opciones.llavero ?? obtenerLlavero(); // falla cerrado antes de leer o escribir nada
  const lote = opciones.lote ?? LOTE_POR_DEFECTO;
  if (!Number.isInteger(lote) || lote < 1 || lote > LOTE_MAXIMO) throw new ErrorMigracion("LOTE_INVALIDO");
  const base = (await db.$queryRaw<{ base: string }[]>`SELECT current_database() AS base`)[0]?.base ?? "";
  const escribe = opciones.aplicar || opciones.reCifrar;
  if (escribe && opciones.base !== base) throw new ErrorMigracion("BASE_NO_COINCIDE");
  const modo: Modo = { aplicar: opciones.aplicar, reCifrar: opciones.reCifrar };
  const filaFuente = await migrarTabla(db, campoCrudo(llavero), llavero, modo, lote);
  const certificacionFondo = await migrarTabla(db, campoEncargo(llavero), llavero, modo, lote);
  return { base, activa: llavero.activa, escribe, filaFuente, certificacionFondo };
}

/** Alertas de una tabla: lo que no se tocó y alguien tiene que revisar. */
const alertasDe = (c: ConteoTabla): number => c.anomalas + c.sinClave + c.noAbren + c.concurrentes;

/** Código de salida del script: 0 sin alertas · 1 con anómalos, sin clave, que no abren o concurrentes · 2 error de uso. */
export function codigoDeSalida(desenlace: ResultadoMigracion | ErrorArgumentos): 0 | 1 | 2 {
  if (desenlace instanceof ErrorArgumentos) return 2;
  return alertasDe(desenlace.filaFuente) + alertasDe(desenlace.certificacionFondo) > 0 ? 1 : 0;
}
