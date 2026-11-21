/**
 * Tope por IP del login, del enlace de un solo uso y del segundo paso (D-014 y TOTP): 20 fallos de una
 * red (IPv4 /32, IPv6 /64, o el balde «sin IP») en 15 min la cortan. Cuenta como fallo todo intento que
 * no esté en RESULTADOS_SIN_FALLO (los éxitos y las marcas de administración). A PROPÓSITO también cuentan
 * TOTP_REPETIDO (un código ya usado es un intento fallido) y CUENTA_BLOQUEADA (seguir probando contra una
 * cuenta bloqueada también agota el tope de la IP). El advisory lock por red
 * serializa los intentos de una misma red dentro de su transacción, para que dos simultáneos no pasen el
 * tope a la vez.
 */
import { Prisma, type PrismaClient, type ResultadoIngreso } from "@prisma/client";
import { VENTANA_FALLOS_MS } from "./limites";

type Base = PrismaClient | Prisma.TransactionClient;

/** Los resultados que NO son un fallo: éxitos de cada paso y las marcas de la CLI y del bloqueo. */
export const RESULTADOS_SIN_FALLO = [
  "EXITO",
  "CLAVE_DEFINIDA",
  "TOTP_EXITO",
  "RECUPERACION_USADA",
  "TOTP_ENROLADO",
  "TOTP_REINICIADO",
  "CODIGOS_REGENERADOS",
  "BLOQUEO_SEGUNDO_PASO",
  "TOTP_PENDIENTE",
] as const satisfies readonly ResultadoIngreso[];

/**
 * La lista va como literales (no como parámetros): así el planificador prueba que la consulta cae dentro
 * del índice parcial `intento_ingreso_fallos_ip_idx`. Son constantes del código, no entrada del usuario.
 */
const SIN_FALLO_SQL = Prisma.raw(
  RESULTADOS_SIN_FALLO.map((r) => {
    if (!/^[A-Z_]+$/.test(r)) throw new Error("Resultado inválido en la lista de topes.");
    return `'${r}'::"ResultadoIngreso"`;
  }).join(", "),
);

export const instante = (d: Date): Prisma.Sql => Prisma.sql`${d.toISOString()}::timestamptz`;
const condicionIp = (red: string | null) => (red === null ? Prisma.sql`"ip" IS NULL` : Prisma.sql`"ip" <<= ${red}::cidr`);

/** La consulta del conteo por IP (se expone para verificar con EXPLAIN que usa el índice parcial). */
export const sqlFallosDeIp = (red: string | null, ahora: Date): Prisma.Sql => Prisma.sql`
    SELECT count(*) AS n FROM "intento_ingreso"
    WHERE ${condicionIp(red)}
      AND "resultado" NOT IN (${SIN_FALLO_SQL})
      AND "ocurridoEn" > ${instante(new Date(ahora.getTime() - VENTANA_FALLOS_MS))}`;

export async function fallosDeIp(db: Base, red: string | null, ahora: Date): Promise<number> {
  const filas = await db.$queryRaw<{ n: bigint }[]>(sqlFallosDeIp(red, ahora));
  return Number(filas[0]?.n ?? 0);
}

/** Serializa los intentos de una red hasta el fin de la transacción. */
export async function bloquearRed(tx: Prisma.TransactionClient, red: string | null): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inv008:ingreso:${red ?? "sin-ip"}`}, 0))`;
}

export const OPCIONES_TX = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10_000, timeout: 10_000 };
