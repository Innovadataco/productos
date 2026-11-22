/**
 * El acceso de un familiar (frente familia-lectura): rol FAMILIA, SOLO LECTURA en la web (src/auth/roles.ts). Lo usa
 * `scripts/acceso-familiar.ts`, que corre Jelk (nunca la Fábrica ni la app: tests/unit/auth/escrituras.candado.test.ts
 * exige que src/app no alcance este módulo). Mismo modelo que el acceso del dueño (src/auth/acceso.ts):
 * - `emitirAccesoFamiliar`: crea el familiar activo y sin clave (o reutiliza el que hay) y emite un enlace de un solo
 *   uso (32 bytes; en la base solo su sha256; vence a los 30 min; solo vale el más reciente). Sin clave es INICIAL; con
 *   clave, RECUPERACION. Después, el familiar define su clave, entra y enrola su propio TOTP como el dueño.
 * - `revocarFamiliar`: lo desactiva y le cierra todo en UNA transacción: sube `sesionVersion` (sus JWT dejan de valer),
 *   borra su pre-sesión, y como el enlace exige una cuenta activa, su enlace pendiente tampoco sirve. Idempotente.
 *   No se reactiva: un familiar revocado no recibe enlace (REVOCADO).
 * - `reiniciarTotpFamiliar`: el reinicio del segundo factor de src/auth/reinicio-totp.ts, solo para un familiar activo.
 * Nunca toca al dueño (ES_DEL_DUENO). Todo con el candado consultivo de las cuentas (el mismo de emitirAcceso) y la
 * fila tomada: dos comandos a la vez no se pisan.
 */
import type { Prisma, PrismaClient, PropositoToken } from "@prisma/client";
import { candadoDeCuentas, generarToken, hashToken } from "./acceso";
import { VIDA_TOKEN_MS } from "./limites";
import { aplicarReinicioTotp, tomarCuentaPorCorreo, type CuentaParaReiniciar } from "./reinicio-totp";
import { OPCIONES_TX } from "./topes";

export type CodigoFamiliar = "ES_DEL_DUENO" | "NO_EXISTE" | "REVOCADO";

const MENSAJES: Readonly<Record<CodigoFamiliar, string>> = {
  ES_DEL_DUENO: "Ese correo es del dueño: este comando no lo toca (el dueño usa crear-acceso-inicial).",
  NO_EXISTE: "No hay un familiar con ese correo: revise --email. No se cambia nada.",
  REVOCADO: "Ese familiar está revocado: no se reactiva ni recibe enlace. No se cambia nada.",
};

export class ErrorFamiliar extends Error {
  override readonly name = "ErrorFamiliar";
  constructor(readonly codigo: CodigoFamiliar) {
    super(MENSAJES[codigo]);
  }
}

export interface EmisionFamiliar {
  readonly token: string;
  readonly usuarioId: string;
  readonly creado: boolean;
  readonly proposito: PropositoToken;
}

interface DatosComando {
  readonly email: string;
  readonly ahora: Date;
}

type Tx = Prisma.TransactionClient;

/** La cuenta del correo, que debe ser de un familiar activo. */
function familiarActivo(cuenta: CuentaParaReiniciar | null): CuentaParaReiniciar {
  if (!cuenta) throw new ErrorFamiliar("NO_EXISTE");
  if (cuenta.rol !== "FAMILIA") throw new ErrorFamiliar("ES_DEL_DUENO");
  if (!cuenta.activo) throw new ErrorFamiliar("REVOCADO");
  return cuenta;
}

async function familiarParaEnlace(tx: Tx, email: string): Promise<{ readonly id: string; readonly creado: boolean; readonly proposito: PropositoToken }> {
  const existente = await tomarCuentaPorCorreo(tx, email);
  if (!existente) {
    const nuevo = await tx.usuario.create({ data: { email, rol: "FAMILIA" }, select: { id: true } });
    return { id: nuevo.id, creado: true, proposito: "INICIAL" };
  }
  const cuenta = familiarActivo(existente);
  const { claveHash } = await tx.usuario.findUniqueOrThrow({ where: { id: cuenta.id }, select: { claveHash: true } });
  return { id: cuenta.id, creado: false, proposito: claveHash === null ? "INICIAL" : "RECUPERACION" };
}

export async function emitirAccesoFamiliar(db: PrismaClient, datos: DatosComando): Promise<EmisionFamiliar> {
  const token = generarToken();
  return db.$transaction(async (tx) => {
    await candadoDeCuentas(tx);
    const familiar = await familiarParaEnlace(tx, datos.email);
    await tx.tokenAcceso.create({
      data: {
        usuarioId: familiar.id,
        tokenHash: hashToken(token),
        proposito: familiar.proposito,
        creadoEn: datos.ahora,
        venceEn: new Date(datos.ahora.getTime() + VIDA_TOKEN_MS),
      },
    });
    return { token, usuarioId: familiar.id, creado: familiar.creado, proposito: familiar.proposito };
  }, OPCIONES_TX);
}

export async function revocarFamiliar(db: PrismaClient, datos: DatosComando): Promise<{ readonly usuarioId: string; readonly yaEstaba: boolean }> {
  return db.$transaction(async (tx) => {
    await candadoDeCuentas(tx);
    const cuenta = await tomarCuentaPorCorreo(tx, datos.email);
    if (!cuenta) throw new ErrorFamiliar("NO_EXISTE");
    if (cuenta.rol !== "FAMILIA") throw new ErrorFamiliar("ES_DEL_DUENO");
    if (!cuenta.activo) return { usuarioId: cuenta.id, yaEstaba: true };
    await tx.usuario.update({ where: { id: cuenta.id }, data: { activo: false, presesionHash: null, sesionVersion: { increment: 1 } } });
    return { usuarioId: cuenta.id, yaEstaba: false };
  }, OPCIONES_TX);
}

export async function reiniciarTotpFamiliar(db: PrismaClient, datos: DatosComando): Promise<{ readonly usuarioId: string }> {
  return db.$transaction(async (tx) => {
    await candadoDeCuentas(tx);
    const cuenta = familiarActivo(await tomarCuentaPorCorreo(tx, datos.email));
    await aplicarReinicioTotp(tx, cuenta.id, datos.ahora);
    return { usuarioId: cuenta.id };
  }, OPCIONES_TX);
}
