/**
 * Recuperación total del segundo factor (perdió el teléfono Y los códigos). Lo corre Jelk, nunca la app:
 *   npx tsx scripts/crear-acceso-inicial.ts --email <correo> --reiniciar-totp
 * En UNA transacción, sobre la fila del dueño (FOR NO KEY UPDATE): borra el secreto, la activación, el último paso
 * y la pre-sesión; anula los códigos de recuperación vigentes; limpia el bloqueo; sube `sesionVersion`
 * (cierra todas las sesiones) y registra TOTP_REINICIADO, que abre la ventana de 30 min para enrolar de
 * nuevo al entrar con la clave. No toca la clave: si también la perdió, corra el comando sin la bandera.
 * El del familiar es el mismo reinicio, por su propio comando (scripts/acceso-familiar.ts --reiniciar-totp).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { ErrorAcceso } from "./acceso";
import { anularCodigos } from "./codigos";
import { OPCIONES_TX } from "./topes";

type Tx = Prisma.TransactionClient;

export interface CuentaParaReiniciar {
  readonly id: string;
  readonly rol: string;
  readonly activo: boolean;
}

/** La cuenta por su correo, tomada con FOR NO KEY UPDATE hasta el fin de la transacción; null si no existe. */
export async function tomarCuentaPorCorreo(tx: Tx, email: string): Promise<CuentaParaReiniciar | null> {
  const filas = await tx.$queryRaw<CuentaParaReiniciar[]>`
    SELECT "id", "rol"::text AS "rol", "activo" FROM "usuario" WHERE "email" = ${email}::citext FOR NO KEY UPDATE`;
  return filas[0] ?? null;
}

/**
 * El reinicio en sí, sobre una cuenta ya tomada y ya autorizada (lo comparten este comando y el del familiar,
 * src/auth/familia.ts): borra el segundo factor, anula los códigos, cierra las sesiones y abre la ventana de 30 min.
 */
export async function aplicarReinicioTotp(tx: Tx, usuarioId: string, ahora: Date): Promise<void> {
  await tx.usuario.update({
    where: { id: usuarioId },
    data: {
      totpSecreto: Prisma.DbNull,
      totpActivadoEn: null,
      totpUltimoPaso: null,
      presesionHash: null,
      bloqueadoHasta: null,
      sesionVersion: { increment: 1 },
    },
  });
  await anularCodigos(tx, usuarioId, ahora);
  await tx.intentoIngreso.create({ data: { usuarioId, ip: null, resultado: "TOTP_REINICIADO", ocurridoEn: ahora } });
}

/** El reinicio del DUEÑO (crear-acceso-inicial --reiniciar-totp): una cuenta que no es DUENO no se toca. */
export async function reiniciarTotp(db: PrismaClient, datos: { readonly email: string; readonly ahora: Date }): Promise<{ readonly usuarioId: string }> {
  return db.$transaction(async (tx) => {
    const cuenta = await tomarCuentaPorCorreo(tx, datos.email);
    if (!cuenta) throw new ErrorAcceso("NO_EXISTE");
    if (cuenta.rol !== "DUENO") throw new ErrorAcceso("ROL_DISTINTO");
    await aplicarReinicioTotp(tx, cuenta.id, datos.ahora);
    return { usuarioId: cuenta.id };
  }, OPCIONES_TX);
}
