/**
 * Recuperación total del segundo factor (perdió el teléfono Y los códigos). Lo corre Jelk, nunca la app:
 *   npx tsx scripts/crear-acceso-inicial.ts --email <correo> --reiniciar-totp
 * En UNA transacción, sobre la fila del dueño (FOR NO KEY UPDATE): borra el secreto, la activación, el último paso
 * y la pre-sesión; anula los códigos de recuperación vigentes; limpia el bloqueo; sube `sesionVersion`
 * (cierra todas las sesiones) y registra TOTP_REINICIADO, que abre la ventana de 30 min para enrolar de
 * nuevo al entrar con la clave. No toca la clave: si también la perdió, corra el comando sin la bandera.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { ErrorAcceso } from "./acceso";
import { anularCodigos } from "./codigos";
import { OPCIONES_TX } from "./topes";

export async function reiniciarTotp(db: PrismaClient, datos: { readonly email: string; readonly ahora: Date }): Promise<{ readonly usuarioId: string }> {
  return db.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<{ id: string; rol: string }[]>`
      SELECT "id", "rol"::text AS "rol" FROM "usuario" WHERE "email" = ${datos.email}::citext FOR NO KEY UPDATE`;
    const cuenta = filas[0];
    if (!cuenta) throw new ErrorAcceso("NO_EXISTE");
    if (cuenta.rol !== "DUENO") throw new ErrorAcceso("ROL_DISTINTO");
    await tx.usuario.update({
      where: { id: cuenta.id },
      data: {
        totpSecreto: Prisma.DbNull,
        totpActivadoEn: null,
        totpUltimoPaso: null,
        presesionHash: null,
        bloqueadoHasta: null,
        sesionVersion: { increment: 1 },
      },
    });
    await anularCodigos(tx, cuenta.id, datos.ahora);
    await tx.intentoIngreso.create({ data: { usuarioId: cuenta.id, ip: null, resultado: "TOTP_REINICIADO", ocurridoEn: datos.ahora } });
    return { usuarioId: cuenta.id };
  }, OPCIONES_TX);
}
