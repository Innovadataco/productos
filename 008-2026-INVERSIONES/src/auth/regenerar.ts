/**
 * Regenerar los códigos de recuperación (/totp/codigos). Exige la sesión completa (la ruta) y además un
 * código TOTP vigente de la app: quien tenga solo la cookie no puede cambiar los códigos. Un código de
 * recuperación no sirve aquí. El código pasa por el antireplay y sus fallos cuentan para el bloqueo del
 * segundo paso. En UNA transacción (red y después cuenta, como el ingreso): anula los vigentes, crea 10
 * nuevos y los devuelve una vez.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { crearCodigosRecuperacion } from "./codigos";
import { tomarCuenta, verificarTotpDeCuenta } from "./cuenta-totp";
import { estaBloqueada, registrarBloqueada, registrarFallo } from "./fallos-segundo-paso";
import { redDeIp } from "./ip";
import { FALLOS_POR_IP } from "./limites";
import { OPCIONES_TX, bloquearRed, fallosDeIp } from "./topes";
import { normalizarCodigoTotp } from "./totp";

type Tx = Prisma.TransactionClient;

export interface DatosRegenerar {
  /** El usuario de la sesión ya revalidada (`exigirSesionApi`). */
  readonly usuarioId: string;
  readonly codigo: string;
  readonly ip: string | null;
  readonly ahora: Date;
}

export type Regeneracion =
  | { readonly ok: true; readonly codigos: readonly string[] }
  | { readonly ok: false; readonly motivo: "IP_LIMITADA" | "FALLO" };

const FALLO = { ok: false, motivo: "FALLO" } as const;

async function decidir(tx: Tx, datos: DatosRegenerar): Promise<Regeneracion> {
  const red = redDeIp(datos.ip);
  await bloquearRed(tx, red);
  if ((await fallosDeIp(tx, red, datos.ahora)) >= FALLOS_POR_IP) return { ok: false, motivo: "IP_LIMITADA" };
  const cuenta = await tomarCuenta(tx, datos.usuarioId);
  if (!cuenta || cuenta.totpActivadoEn === null) return FALLO;
  if (estaBloqueada(cuenta, datos.ahora)) {
    await registrarBloqueada(tx, cuenta.id, datos.ip, datos.ahora);
    return FALLO;
  }
  const codigo = normalizarCodigoTotp(datos.codigo);
  const { verificacion, cambios } = codigo
    ? verificarTotpDeCuenta(cuenta, codigo, datos.ahora)
    : { verificacion: { ok: false, motivo: "INCORRECTO" } as const, cambios: {} };
  if (!verificacion.ok) {
    await registrarFallo(tx, cuenta, verificacion.motivo === "REPETIDO" ? "TOTP_REPETIDO" : "TOTP_INCORRECTO", datos.ip, datos.ahora);
    return FALLO;
  }
  await tx.usuario.update({ where: { id: cuenta.id }, data: cambios });
  const codigos = await crearCodigosRecuperacion(tx, cuenta.id, datos.ahora);
  await tx.intentoIngreso.create({ data: { usuarioId: cuenta.id, ip: datos.ip, resultado: "CODIGOS_REGENERADOS", ocurridoEn: datos.ahora } });
  return { ok: true, codigos };
}

export async function regenerarCodigos(db: PrismaClient, datos: DatosRegenerar): Promise<Regeneracion> {
  if ((await fallosDeIp(db, redDeIp(datos.ip), datos.ahora)) >= FALLOS_POR_IP) return { ok: false, motivo: "IP_LIMITADA" };
  return db.$transaction((tx) => decidir(tx, datos), OPCIONES_TX);
}
