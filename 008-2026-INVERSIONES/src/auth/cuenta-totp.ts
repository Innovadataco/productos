/**
 * La cuenta del segundo paso, tomada con FOR NO KEY UPDATE dentro de la transacción (los intentos de una
 * misma cuenta se serializan: un código no entra dos veces aunque lleguen dos pedidos a la vez; NO KEY deja
 * pasar los INSERT con llave foránea a la cuenta, como los de intento_ingreso), y la regla de
 * la pre-sesión: solo vale si la cuenta sigue activa, es de un rol con acceso web (DUENO o FAMILIA, src/auth/roles.ts),
 * tiene clave, la versión de sesión es la de
 * la pre-sesión y su `jti` es el que guardó el último paso de la clave (`presesionHash`).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { hashJti, type DatosPresesion } from "./presesion";
import { tieneAccesoWeb } from "./roles";
import { descifrarSecretoTotp, necesitaRecifrar, cifrarSecretoTotp } from "./secreto-totp";
import { verificarTotp, type VerificacionTotp } from "./totp";

type Tx = Prisma.TransactionClient;

const CAMPOS = {
  id: true,
  email: true,
  rol: true,
  activo: true,
  claveHash: true,
  sesionVersion: true,
  bloqueadoHasta: true,
  presesionHash: true,
  totpSecreto: true,
  totpActivadoEn: true,
  totpUltimoPaso: true,
} as const satisfies Prisma.UsuarioSelect;

export type CuentaTotp = Prisma.UsuarioGetPayload<{ select: typeof CAMPOS }>;

/** La fila del usuario sin bloquearla (solo lectura, para las páginas); null si no existe. */
export const leerCuenta = (db: PrismaClient, usuarioId: string): Promise<CuentaTotp | null> =>
  db.usuario.findUnique({ where: { id: usuarioId }, select: CAMPOS });

/** La fila del usuario, bloqueada hasta el fin de la transacción; null si no existe. */
export async function tomarCuenta(tx: Tx, usuarioId: string): Promise<CuentaTotp | null> {
  await tx.$executeRaw`SELECT 1 FROM "usuario" WHERE "id" = ${usuarioId} FOR NO KEY UPDATE`;
  return tx.usuario.findUnique({ where: { id: usuarioId }, select: CAMPOS });
}

/** La pre-sesión es la vigente de esta cuenta (sin mirar el estado del TOTP). */
export function presesionVigente(cuenta: CuentaTotp | null, pre: DatosPresesion): cuenta is CuentaTotp {
  return (
    cuenta !== null &&
    cuenta.activo &&
    tieneAccesoWeb(cuenta.rol) &&
    cuenta.claveHash !== null &&
    cuenta.sesionVersion === pre.sesionVersion &&
    cuenta.presesionHash !== null &&
    cuenta.presesionHash === hashJti(pre.jti)
  );
}

export interface TotpVerificado {
  readonly verificacion: VerificacionTotp;
  /** Lo que hay que escribir en la cuenta si entra: el paso nuevo y, si toca, el sobre re-cifrado. */
  readonly cambios: Prisma.UsuarioUpdateInput;
}

/** Verifica el código contra el secreto de la cuenta (activo o pendiente) y su último paso. */
export function verificarTotpDeCuenta(cuenta: CuentaTotp, codigo: string, ahora: Date): TotpVerificado {
  const secreto = descifrarSecretoTotp(cuenta.totpSecreto, cuenta.id);
  const verificacion = verificarTotp(secreto, codigo, ahora.getTime(), cuenta.totpUltimoPaso);
  if (!verificacion.ok) return { verificacion, cambios: {} };
  // Rotación de la clave de cifrado (decisión D3): en cada éxito el sobre queda con la clave activa.
  const recifrado = necesitaRecifrar(cuenta.totpSecreto) ? { totpSecreto: cifrarSecretoTotp(secreto, cuenta.id) } : {};
  return { verificacion, cambios: { totpUltimoPaso: verificacion.paso, ...recifrado } };
}
