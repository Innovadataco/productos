import "server-only";
/**
 * El gasto del mes de la nube (E8), valorado: cada corrida con el precio del modelo que la respondió. El modelo sale del
 * `modeloDigest` de la fila (el `model` que devolvió la API; inv_ia no lee la columna `modelo`): un id que no sea
 * exactamente uno de la lista se cobra al precio de opus, el más alto (el tope solo se vuelve más estricto). Haiku, con
 * el tramo de cada corrida (más de 100K tokens de entrada, el precio largo). Los tokens y las corridas son los mismos
 * de `gastoDelMes` (E3; lo prueba tests/integracion/ia/config-ia.test.ts); los FALLIDO no traen tokens y cuentan 0.
 *
 * Lo usan la pantalla (frente al tope) y el servicio (`leerGastoNube`, la dependencia `gastoDelMes` de la puerta nube).
 * Con más de MAX_CORRIDAS_GASTO corridas en el mes no se adivina: GASTO_NO_VERIFICABLE (la nube no llama).
 */
import type { PrismaClient } from "@prisma/client";
import { costoTokensMicroUsd, modeloDeDigest, type GastoDelMes, type LeerGastoDelMes } from "../nube/tope";
import { rangoDelMes } from "../registro/mes";
import { ErrorConfigIa } from "./errores";

/** Tope de filas que se leen por mes: a 3 resúmenes por día hábil son menos de 100; más es una anomalía. */
export const MAX_CORRIDAS_GASTO = 10_000;

export interface GastoNube extends GastoDelMes {
  readonly microUsd: bigint;
  /** Corridas de la nube en el mes, de cualquier estado. */
  readonly corridas: number;
}

/** El gasto valorado del mes de `dia` (AAAA-MM-DD, hora de Colombia). */
export async function gastoNubeDelMes(db: Pick<PrismaClient, "resumenIa">, dia: string): Promise<GastoNube> {
  const { desde, hasta } = rangoDelMes(dia);
  const filas = await db.resumenIa.findMany({
    where: { puerta: "nube", generadoEn: { gte: desde, lt: hasta } },
    select: { modeloDigest: true, tokensEntrada: true, tokensSalida: true },
    take: MAX_CORRIDAS_GASTO + 1,
  });
  if (filas.length > MAX_CORRIDAS_GASTO) throw new ErrorConfigIa("GASTO_NO_VERIFICABLE");
  let microUsd = 0n;
  let tokensEntrada = 0;
  let tokensSalida = 0;
  for (const f of filas) {
    const entrada = f.tokensEntrada ?? 0;
    const salida = f.tokensSalida ?? 0;
    microUsd += costoTokensMicroUsd(modeloDeDigest(f.modeloDigest) ?? "claude-opus-5-5", entrada, salida);
    tokensEntrada += entrada;
    tokensSalida += salida;
  }
  return Object.freeze({ mes: dia.slice(0, 7), tokensEntrada, tokensSalida, microUsd, corridas: filas.length });
}

/** La dependencia `gastoDelMes` de la puerta nube, con el mes de hoy en Colombia (`hoy` se inyecta en las pruebas). */
export function leerGastoNube(db: Pick<PrismaClient, "resumenIa">, hoy: () => string): LeerGastoDelMes {
  return async () => {
    const g = await gastoNubeDelMes(db, hoy());
    return Object.freeze({ mes: g.mes, tokensEntrada: g.tokensEntrada, tokensSalida: g.tokensSalida, microUsd: g.microUsd });
  };
}
