/**
 * Enrolamiento del TOTP del dueño. Solo hay enrolamiento en el primer ingreso: dentro de los 30 minutos
 * siguientes a definir la clave con el enlace de un solo uso (CLAVE_DEFINIDA) o a que Jelk corra
 * `crear-acceso-inicial --reiniciar-totp` (TOTP_REINICIADO). Fuera de esa ventana, quien tenga la clave
 * no puede atar su propio TOTP a la cuenta (riesgo TOFU, decisión D1 de la GATE 1): hay que volver a la CLI.
 * - `prepararSegundoPaso` (en la transacción del paso de la clave): guarda el hash de la pre-sesión y, sin
 *   TOTP activo y con la ventana abierta, el secreto pendiente: el MISMO mientras dure la ventana (volver a
 *   pasar la clave no invalida el QR ya escaneado) y uno NUEVO si la ventana es otra (otro enlace o
 *   `--reiniciar-totp`). Cada secreto nuevo queda registrado (TOTP_PENDIENTE). Así el GET de /totp/enrolar
 *   no escribe. Fuera de la ventana, el pendiente se borra.
 * - `datosDeEnrolamiento` (la página, solo lectura): el correo, el base32 y el `otpauth://` del pendiente.
 * - `confirmarEnrolamiento` (POST /api/sesion/totp/enrolar): con un código válido del pendiente, en UNA
 *   transacción activa el TOTP, fija el último paso (antireplay), sube `sesionVersion` (mata las sesiones
 *   de solo clave de antes), gasta la pre-sesión, crea 10 códigos de recuperación y los devuelve UNA vez.
 *   Los fallos cuentan para el bloqueo del segundo paso (decisión D5).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { crearCodigosRecuperacion } from "./codigos";
import { leerCuenta, presesionVigente, tomarCuenta, verificarTotpDeCuenta, type CuentaTotp } from "./cuenta-totp";
import { estaBloqueada, registrarBloqueada, registrarFallo } from "./fallos-segundo-paso";
import { redDeIp } from "./ip";
import { FALLOS_POR_IP, VENTANA_ENROLAR_MS } from "./limites";
import { hashJti, type DatosPresesion } from "./presesion";
import { cifrarSecretoTotp, descifrarSecretoTotp } from "./secreto-totp";
import { OPCIONES_TX, bloquearRed, fallosDeIp } from "./topes";
import { codificarBase32, generarSecretoTotp, normalizarCodigoTotp, sinRelleno, uriOtpauth } from "./totp";

type Tx = Prisma.TransactionClient;
export type PasoSiguiente = "totp" | "enrolar";

/** El CLAVE_DEFINIDA o TOTP_REINICIADO más reciente de los 30 min anteriores a `ahora` (abre la ventana), o null. */
export async function aperturaDeEnrolamiento(tx: Tx | PrismaClient, usuarioId: string, ahora: Date): Promise<Date | null> {
  const apertura = await tx.intentoIngreso.findFirst({
    where: {
      usuarioId,
      resultado: { in: ["CLAVE_DEFINIDA", "TOTP_REINICIADO"] },
      ocurridoEn: { gt: new Date(ahora.getTime() - VENTANA_ENROLAR_MS), lte: ahora },
    },
    orderBy: { ocurridoEn: "desc" },
    select: { ocurridoEn: true },
  });
  return apertura?.ocurridoEn ?? null;
}

/** true si la ventana de enrolamiento de la cuenta está abierta en `ahora`. */
export const ventanaDeEnrolarAbierta = async (tx: Tx | PrismaClient, usuarioId: string, ahora: Date): Promise<boolean> =>
  (await aperturaDeEnrolamiento(tx, usuarioId, ahora)) !== null;

export interface CuentaPrimerPaso {
  readonly id: string;
  readonly totpActivadoEn: Date | null;
  /** Si ya hay un secreto guardado (con el TOTP sin activar, es el pendiente). */
  readonly conSecreto: boolean;
}

/** true si el secreto pendiente se generó en esta ventana (después de su apertura). */
async function pendienteDeLaVentana(tx: Tx, usuarioId: string, apertura: Date): Promise<boolean> {
  const generado = await tx.intentoIngreso.findFirst({
    where: { usuarioId, resultado: "TOTP_PENDIENTE", ocurridoEn: { gte: apertura } },
    select: { id: true },
  });
  return generado !== null;
}

/** Deja lista la pre-sesión (y, si toca, el secreto pendiente) y dice el paso siguiente. */
export async function prepararSegundoPaso(tx: Tx, cuenta: CuentaPrimerPaso, jti: string, ip: string | null, ahora: Date): Promise<PasoSiguiente> {
  const presesionHash = hashJti(jti);
  if (cuenta.totpActivadoEn !== null) {
    await tx.usuario.update({ where: { id: cuenta.id }, data: { presesionHash } });
    return "totp";
  }
  const apertura = await aperturaDeEnrolamiento(tx, cuenta.id, ahora);
  if (apertura === null) {
    await tx.usuario.update({ where: { id: cuenta.id }, data: { presesionHash, totpSecreto: Prisma.DbNull } });
    return "enrolar";
  }
  if (cuenta.conSecreto && (await pendienteDeLaVentana(tx, cuenta.id, apertura))) {
    await tx.usuario.update({ where: { id: cuenta.id }, data: { presesionHash } });
    return "enrolar";
  }
  await tx.usuario.update({ where: { id: cuenta.id }, data: { presesionHash, totpSecreto: cifrarSecretoTotp(generarSecretoTotp(), cuenta.id) } });
  await tx.intentoIngreso.create({ data: { usuarioId: cuenta.id, ip, resultado: "TOTP_PENDIENTE", ocurridoEn: ahora } });
  return "enrolar";
}

export type Enrolamiento =
  | { readonly estado: "LISTO"; readonly email: string; readonly secreto: string; readonly uri: string }
  | { readonly estado: "VENCIDA" | "ACTIVO" | "FUERA_DE_PLAZO" };


/** Lo que muestra /totp/enrolar. Solo lee: no crea el secreto (eso lo hizo el paso de la clave). */
export async function datosDeEnrolamiento(db: PrismaClient, pre: DatosPresesion, ahora: Date): Promise<Enrolamiento> {
  const cuenta = await leerCuenta(db, pre.sub);
  if (!presesionVigente(cuenta, pre)) return { estado: "VENCIDA" };
  if (cuenta.totpActivadoEn !== null) return { estado: "ACTIVO" };
  if (cuenta.totpSecreto === null || !(await ventanaDeEnrolarAbierta(db, cuenta.id, ahora))) return { estado: "FUERA_DE_PLAZO" };
  const secreto = descifrarSecretoTotp(cuenta.totpSecreto, cuenta.id);
  return { estado: "LISTO", email: cuenta.email, secreto: sinRelleno(codificarBase32(secreto)), uri: uriOtpauth(secreto, cuenta.email) };
}

export interface DatosConfirmacion {
  readonly presesion: DatosPresesion;
  readonly codigo: string;
  readonly ip: string | null;
  readonly ahora: Date;
}

export type Confirmacion =
  | { readonly ok: true; readonly usuarioId: string; readonly sesionVersion: number; readonly codigos: readonly string[] }
  | { readonly ok: false; readonly motivo: "PRESESION_INVALIDA" | "IP_LIMITADA" | "FUERA_DE_PLAZO" | "FALLO" };

const FALLO = { ok: false, motivo: "FALLO" } as const;

async function activar(tx: Tx, cuenta: CuentaTotp, datos: DatosConfirmacion): Promise<Confirmacion> {
  const codigo = normalizarCodigoTotp(datos.codigo);
  const { verificacion, cambios } = codigo
    ? verificarTotpDeCuenta(cuenta, codigo, datos.ahora)
    : { verificacion: { ok: false, motivo: "INCORRECTO" } as const, cambios: {} };
  if (!verificacion.ok) {
    await registrarFallo(tx, cuenta, "TOTP_INCORRECTO", datos.ip, datos.ahora);
    return FALLO;
  }
  const { sesionVersion } = await tx.usuario.update({
    where: { id: cuenta.id },
    data: { ...cambios, totpActivadoEn: datos.ahora, presesionHash: null, sesionVersion: { increment: 1 } },
    select: { sesionVersion: true },
  });
  const codigos = await crearCodigosRecuperacion(tx, cuenta.id, datos.ahora);
  await tx.intentoIngreso.create({ data: { usuarioId: cuenta.id, ip: datos.ip, resultado: "TOTP_ENROLADO", ocurridoEn: datos.ahora } });
  return { ok: true, usuarioId: cuenta.id, sesionVersion, codigos };
}

async function decidirConfirmacion(tx: Tx, datos: DatosConfirmacion): Promise<Confirmacion> {
  const red = redDeIp(datos.ip);
  await bloquearRed(tx, red);
  if ((await fallosDeIp(tx, red, datos.ahora)) >= FALLOS_POR_IP) return { ok: false, motivo: "IP_LIMITADA" };
  const cuenta = await tomarCuenta(tx, datos.presesion.sub);
  if (!presesionVigente(cuenta, datos.presesion) || cuenta.totpActivadoEn !== null) return { ok: false, motivo: "PRESESION_INVALIDA" };
  if (estaBloqueada(cuenta, datos.ahora)) {
    await registrarBloqueada(tx, cuenta.id, datos.ip, datos.ahora);
    return FALLO;
  }
  if (cuenta.totpSecreto === null || !(await ventanaDeEnrolarAbierta(tx, cuenta.id, datos.ahora))) return { ok: false, motivo: "FUERA_DE_PLAZO" };
  return activar(tx, cuenta, datos);
}

export async function confirmarEnrolamiento(db: PrismaClient, datos: DatosConfirmacion): Promise<Confirmacion> {
  if ((await fallosDeIp(db, redDeIp(datos.ip), datos.ahora)) >= FALLOS_POR_IP) return { ok: false, motivo: "IP_LIMITADA" };
  return db.$transaction((tx) => decidirConfirmacion(tx, datos), OPCIONES_TX);
}
