import "server-only";
/**
 * Una versión NUEVA de la configuración de la IA (E8), contra la última que vio el formulario: si otra entró en medio
 * (también si dos llegan a la vez y chocan en la versión única), CONFIG_CAMBIO sin escribir nada. El autor sale de la
 * sesión (lo pasa la ruta), nunca del cuerpo. La hora la pone la base. Nada se edita: la nueva reemplaza a la vigente y
 * la anterior queda en la historia. Corre como inv_app (INSERT por columna, sin "creadaEn").
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { TAREAS_IA } from "./parametros";
import type { EntradaConfigIa } from "./pedido";
import { ErrorConfigIa } from "./errores";

export { ErrorConfigIa } from "./errores";

export interface OpcionesCrear {
  readonly autorId: string;
  /** La última versión que vio el formulario (0 si todavía no había ninguna). */
  readonly ultimaEsperada: number;
}

const MICRO_USD_POR_USD = 1_000_000n;
const MICRO_USD_POR_CENTAVO = 10_000n;

/** micro-USD (con a lo sumo dos decimales de dólar) como el texto de un Decimal(6,2). */
export function usdDeMicro(micro: bigint): string {
  const centavos = (micro % MICRO_USD_POR_USD) / MICRO_USD_POR_CENTAVO;
  return `${micro / MICRO_USD_POR_USD}.${String(centavos).padStart(2, "0")}`;
}

/** Centésimas (0 a 100) como el texto de un Decimal(3,2). */
export const decimalDeCentesimas = (c: number): string => `${Math.trunc(c / 100)}.${String(c % 100).padStart(2, "0")}`;

/** Las tareas en el orden de la lista, como las guarda el JSON (una entrada por tarea). */
const tareasJson = (entrada: EntradaConfigIa): Prisma.InputJsonObject =>
  Object.fromEntries(TAREAS_IA.map((t) => [t, { activo: entrada.tareas[t].activo, modeloLocal: entrada.tareas[t].modeloLocal }]));

function datos(entrada: EntradaConfigIa, version: number, autorId: string): Prisma.ConfigIaUncheckedCreateInput {
  return {
    version,
    modo: entrada.modo,
    ollamaHost: entrada.ollamaHost,
    ollamaPuerto: entrada.ollamaPuerto,
    temperaturaLocal: new Prisma.Decimal(decimalDeCentesimas(entrada.temperaturaCentesimas)),
    tareas: tareasJson(entrada),
    modeloNube: entrada.modeloNube,
    esfuerzoNube: entrada.esfuerzoNube,
    topeMensualUsd: entrada.topeMicroUsd === null ? null : new Prisma.Decimal(usdDeMicro(entrada.topeMicroUsd)),
    horaResumen: entrada.horaResumen,
    limiteSegundos: entrada.limiteSegundos,
    analisisDemanda: entrada.analisisDemanda,
    motivo: entrada.motivo,
    autorId,
  };
}

const esChoque = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
const esAutorInexistente = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";

/** Crea la versión siguiente a `ultimaEsperada`. Lanza ErrorConfigIa (CONFIG_CAMBIO o AUTOR_INEXISTENTE). */
export async function crearVersionConfigIa(db: Pick<PrismaClient, "configIa">, entrada: EntradaConfigIa, opciones: OpcionesCrear): Promise<{ readonly version: number }> {
  const ultima = (await db.configIa.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
  if (ultima !== opciones.ultimaEsperada) throw new ErrorConfigIa("CONFIG_CAMBIO");
  try {
    const creada = await db.configIa.create({ data: datos(entrada, ultima + 1, opciones.autorId), select: { version: true } });
    return Object.freeze({ version: creada.version });
  } catch (error) {
    if (esChoque(error)) throw new ErrorConfigIa("CONFIG_CAMBIO");
    if (esAutorInexistente(error)) throw new ErrorConfigIa("AUTOR_INEXISTENTE");
    throw error;
  }
}
