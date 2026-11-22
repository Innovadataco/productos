/**
 * La foto de solo lectura del export de hechos (E7): UNA transacción interactiva REPEATABLE READ cuyo primer comando es
 * `SET TRANSACTION READ ONLY` (la base rechaza cualquier escritura adentro: lo prueba la integración con un INSERT).
 * Los lectores de siempre reciben un cliente que se usa como un PrismaClient: sus modelos son los de la transacción, y
 * su `$transaction` (con función, como `enSoloLectura`, o con una lista, como `posiciones`) corre dentro de la MISMA foto
 * y la misma conexión, sin abrir otra (PostgreSQL acepta repetir SET TRANSACTION READ ONLY adentro: ver
 * `enEstaTransaccion` en src/app/datos-oficiales/datos.ts, que hace lo mismo solo con la función).
 */
import { Prisma, type PrismaClient } from "@prisma/client";

export const OPCIONES_FOTO = Object.freeze({
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  /** El export lee el tablero, el plan, las series y proyecta (el motor tarda hasta ≈ 1 s): holgura amplia. */
  timeout: 120_000,
  maxWait: 10_000,
});

/** El cliente de la foto: los modelos de `tx` y un `$transaction` que no sale de ella. */
export function clienteDeLaFoto(tx: Prisma.TransactionClient): PrismaClient {
  const transaccion = (arg: unknown): Promise<unknown> => {
    if (typeof arg === "function") return (arg as (c: PrismaClient) => Promise<unknown>)(cliente);
    if (Array.isArray(arg)) return Promise.all(arg);
    return Promise.reject(new TypeError("La foto solo corre funciones o listas de consultas."));
  };
  const cliente = new Proxy(tx, {
    get: (destino, propiedad) => (propiedad === "$transaction" ? transaccion : Reflect.get(destino, propiedad)),
  }) as unknown as PrismaClient;
  return cliente;
}

/** Corre `leer` dentro de la foto de solo lectura. */
export function enFotoDeSoloLectura<T>(db: PrismaClient, leer: (cliente: PrismaClient) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return leer(clienteDeLaFoto(tx));
  }, OPCIONES_FOTO);
}
