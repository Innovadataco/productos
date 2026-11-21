/**
 * Segundo paso del ingreso (TOTP del dueño): con una pre-sesión vigente, el código de la app (6 dígitos) o
 * uno de recuperación (XXXX-XXXX-XXXX-XXXX) abre la sesión. Todo en UNA transacción corta, en el orden de
 * src/auth/ingreso.ts: primero la red (advisory lock y tope de 20 fallos por IP) y después la cuenta
 * (FOR UPDATE). Así dos pedidos con el mismo código no entran los dos (antireplay por `totpUltimoPaso`) y un
 * código de recuperación se gasta una vez. Al entrar se borra `presesionHash`: la pre-sesión es de un uso.
 * - Pre-sesión que no es la vigente (reemplazada, de otra versión, o la cuenta no tiene TOTP activo):
 *   PRESESION_INVALIDA, sin evaluar el código ni registrar nada (quien llega no probó ningún código).
 * - Cuenta bloqueada: se registra CUENTA_BLOQUEADA y no se evalúa el código.
 * - Fallos: src/auth/fallos-segundo-paso.ts (5 bloquean, cada bloqueo en 24 h el doble). La ruta responde
 *   siempre el mismo mensaje, sea cual sea el fallo.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { gastarCodigo } from "./codigos";
import { leerCuenta, presesionVigente, tomarCuenta, verificarTotpDeCuenta, type CuentaTotp } from "./cuenta-totp";
import { estaBloqueada, registrarBloqueada, registrarFallo } from "./fallos-segundo-paso";
import { redDeIp } from "./ip";
import { FALLOS_POR_IP } from "./limites";
import type { DatosPresesion } from "./presesion";
import { normalizarCodigoRecuperacion } from "./recuperacion";
import { OPCIONES_TX, bloquearRed, fallosDeIp } from "./topes";
import { normalizarCodigoTotp } from "./totp";

type Tx = Prisma.TransactionClient;

export interface DatosSegundoPaso {
  /** La pre-sesión ya verificada (firma, vencimiento y forma: src/auth/presesion.ts). */
  readonly presesion: DatosPresesion;
  readonly codigo: string;
  /** IP del cliente ya validada (`ipDeSolicitud`), o null. */
  readonly ip: string | null;
  readonly ahora: Date;
}

export type SegundoPaso =
  | {
      readonly ok: true;
      readonly usuarioId: string;
      readonly sesionVersion: number;
      readonly via: "TOTP" | "RECUPERACION";
      /** Códigos de recuperación vigentes que quedan (solo si se usó uno). */
      readonly restantes: number | null;
    }
  | { readonly ok: false; readonly motivo: "PRESESION_INVALIDA" | "IP_LIMITADA" | "FALLO" };

const FALLO = { ok: false, motivo: "FALLO" } as const;

async function conTotp(tx: Tx, cuenta: CuentaTotp, codigo: string, datos: DatosSegundoPaso): Promise<SegundoPaso> {
  const { verificacion, cambios } = verificarTotpDeCuenta(cuenta, codigo, datos.ahora);
  if (!verificacion.ok) {
    await registrarFallo(tx, cuenta, verificacion.motivo === "REPETIDO" ? "TOTP_REPETIDO" : "TOTP_INCORRECTO", datos.ip, datos.ahora);
    return FALLO;
  }
  await tx.usuario.update({ where: { id: cuenta.id }, data: { ...cambios, presesionHash: null } });
  await tx.intentoIngreso.create({ data: { usuarioId: cuenta.id, ip: datos.ip, resultado: "TOTP_EXITO", ocurridoEn: datos.ahora } });
  return { ok: true, usuarioId: cuenta.id, sesionVersion: cuenta.sesionVersion, via: "TOTP", restantes: null };
}

async function conRecuperacion(tx: Tx, cuenta: CuentaTotp, normalizado: string, datos: DatosSegundoPaso): Promise<SegundoPaso> {
  const restantes = await gastarCodigo(tx, cuenta.id, normalizado, datos.ahora);
  if (restantes === null) {
    await registrarFallo(tx, cuenta, "RECUPERACION_INVALIDA", datos.ip, datos.ahora);
    return FALLO;
  }
  await tx.usuario.update({ where: { id: cuenta.id }, data: { presesionHash: null } });
  await tx.intentoIngreso.create({ data: { usuarioId: cuenta.id, ip: datos.ip, resultado: "RECUPERACION_USADA", ocurridoEn: datos.ahora } });
  return { ok: true, usuarioId: cuenta.id, sesionVersion: cuenta.sesionVersion, via: "RECUPERACION", restantes };
}

async function decidir(tx: Tx, datos: DatosSegundoPaso): Promise<SegundoPaso> {
  const red = redDeIp(datos.ip);
  await bloquearRed(tx, red);
  if ((await fallosDeIp(tx, red, datos.ahora)) >= FALLOS_POR_IP) return { ok: false, motivo: "IP_LIMITADA" };
  const cuenta = await tomarCuenta(tx, datos.presesion.sub);
  if (!presesionVigente(cuenta, datos.presesion) || cuenta.totpActivadoEn === null) return { ok: false, motivo: "PRESESION_INVALIDA" };
  if (estaBloqueada(cuenta, datos.ahora)) {
    await registrarBloqueada(tx, cuenta.id, datos.ip, datos.ahora);
    return FALLO;
  }
  const totp = normalizarCodigoTotp(datos.codigo);
  if (totp) return conTotp(tx, cuenta, totp, datos);
  const normalizado = normalizarCodigoRecuperacion(datos.codigo);
  if (normalizado) return conRecuperacion(tx, cuenta, normalizado, datos);
  await registrarFallo(tx, cuenta, "TOTP_INCORRECTO", datos.ip, datos.ahora);
  return FALLO;
}

export async function verificarSegundoPaso(db: PrismaClient, datos: DatosSegundoPaso): Promise<SegundoPaso> {
  // Una IP ya cortada no escribe (se vuelve a contar dentro de la transacción).
  if ((await fallosDeIp(db, redDeIp(datos.ip), datos.ahora)) >= FALLOS_POR_IP) return { ok: false, motivo: "IP_LIMITADA" };
  return db.$transaction((tx) => decidir(tx, datos), OPCIONES_TX);
}

/** Qué muestra /totp con esta pre-sesión (solo lee): el formulario, el enrolamiento o volver a ingresar. */
export async function estadoDelSegundoPaso(db: PrismaClient, pre: DatosPresesion): Promise<"VERIFICAR" | "ENROLAR" | "VENCIDA"> {
  const cuenta = await leerCuenta(db, pre.sub);
  if (!presesionVigente(cuenta, pre)) return "VENCIDA";
  return cuenta.totpActivadoEn === null ? "ENROLAR" : "VERIFICAR";
}
