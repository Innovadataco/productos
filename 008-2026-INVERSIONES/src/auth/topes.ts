/**
 * Tope por IP del login y del enlace de un solo uso (D-014): 20 fallos de una red (IPv4 /32, IPv6 /64,
 * o el balde «sin IP») en 15 min la cortan. Cuenta como fallo todo intento que no sea EXITO ni
 * CLAVE_DEFINIDA. El advisory lock por red serializa los intentos de una misma red dentro de su
 * transacción, para que dos simultáneos no pasen el tope a la vez.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { VENTANA_FALLOS_MS } from "./limites";

type Base = PrismaClient | Prisma.TransactionClient;

export const instante = (d: Date): Prisma.Sql => Prisma.sql`${d.toISOString()}::timestamptz`;
const condicionIp = (red: string | null) => (red === null ? Prisma.sql`"ip" IS NULL` : Prisma.sql`"ip" <<= ${red}::cidr`);

export async function fallosDeIp(db: Base, red: string | null, ahora: Date): Promise<number> {
  const desde = new Date(ahora.getTime() - VENTANA_FALLOS_MS);
  const filas = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "intento_ingreso"
    WHERE ${condicionIp(red)}
      AND "resultado" NOT IN ('EXITO'::"ResultadoIngreso", 'CLAVE_DEFINIDA'::"ResultadoIngreso")
      AND "ocurridoEn" > ${instante(desde)}`;
  return Number(filas[0]?.n ?? 0);
}

/** Serializa los intentos de una red hasta el fin de la transacción. */
export async function bloquearRed(tx: Prisma.TransactionClient, red: string | null): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inv008:ingreso:${red ?? "sin-ip"}`}, 0))`;
}

export const OPCIONES_TX = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10_000, timeout: 10_000 };
