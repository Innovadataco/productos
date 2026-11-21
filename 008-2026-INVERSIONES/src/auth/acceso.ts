/**
 * Acceso sin contraseña inicial (D-014): enlace de un solo uso para definir la clave.
 * - `emitirAcceso` (lo usa `scripts/crear-acceso-inicial.ts`, que corre Jelk): crea el dueño sin clave
 *   o reutiliza el que hay, y emite un token de 32 bytes. En la base queda solo su sha256; vence a los
 *   30 min. Solo vale el más reciente de cada usuario: emitir uno nuevo deja sin valor los anteriores.
 *   Sirve igual para el primer acceso (INICIAL) y para recuperar la clave (RECUPERACION).
 * - `definirClave` (lo usa POST /api/sesion/definir-clave): valida el token y, en UNA transacción, fija
 *   la clave, marca el token usado, sube `sesionVersion` (cierra las sesiones abiertas) y limpia el
 *   bloqueo. Comparte el tope por IP del ingreso, y cada intento queda en `intento_ingreso`.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient, PropositoToken } from "@prisma/client";
import { hashClave, largoValido } from "./clave";
import { redDeIp } from "./ip";
import { FALLOS_POR_IP, TOKEN_BYTES, VIDA_TOKEN_MS } from "./limites";
import { OPCIONES_TX, bloquearRed, fallosDeIp } from "./topes";

export type CodigoAcceso = "OTRO_DUENO" | "ROL_DISTINTO" | "NO_EXISTE";

const MENSAJES: Readonly<Record<CodigoAcceso, string>> = {
  OTRO_DUENO: "Ya hay un dueño registrado con otro correo: revise --email. No se crea otro.",
  ROL_DISTINTO: "Ese correo es de una cuenta que no es DUENO: no se toca.",
  NO_EXISTE: "No hay una cuenta con ese correo: revise --email. No se reinicia nada.",
};

export class ErrorAcceso extends Error {
  override readonly name = "ErrorAcceso";
  constructor(readonly codigo: CodigoAcceso) {
    super(MENSAJES[codigo]);
  }
}

/** base64url sin relleno: 32 bytes son 43 caracteres. */
const FORMA_TOKEN = /^[A-Za-z0-9_-]{43,128}$/;

export const generarToken = (): string => randomBytes(TOKEN_BYTES).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");
export const formaDeToken = (token: string): boolean => FORMA_TOKEN.test(token);

export interface Emision {
  readonly token: string;
  readonly usuarioId: string;
  readonly creado: boolean;
  readonly proposito: PropositoToken;
}

type Tx = Prisma.TransactionClient;

async function duenoParaEnlace(tx: Tx, email: string): Promise<{ id: string; creado: boolean; proposito: PropositoToken }> {
  const existente = await tx.usuario.findUnique({ where: { email }, select: { id: true, rol: true, claveHash: true } });
  if (existente) {
    if (existente.rol !== "DUENO") throw new ErrorAcceso("ROL_DISTINTO");
    return { id: existente.id, creado: false, proposito: existente.claveHash === null ? "INICIAL" : "RECUPERACION" };
  }
  if ((await tx.usuario.count({ where: { rol: "DUENO" } })) > 0) throw new ErrorAcceso("OTRO_DUENO");
  const nuevo = await tx.usuario.create({ data: { email, rol: "DUENO" }, select: { id: true } });
  return { id: nuevo.id, creado: true, proposito: "INICIAL" };
}

export async function emitirAcceso(db: PrismaClient, datos: { readonly email: string; readonly ahora: Date }): Promise<Emision> {
  const token = generarToken();
  return db.$transaction(async (tx) => {
    // Dos emisiones a la vez no crean dos dueños.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('inv008:cuentas', 0))`;
    const dueno = await duenoParaEnlace(tx, datos.email);
    await tx.tokenAcceso.create({
      data: {
        usuarioId: dueno.id,
        tokenHash: hashToken(token),
        proposito: dueno.proposito,
        creadoEn: datos.ahora,
        venceEn: new Date(datos.ahora.getTime() + VIDA_TOKEN_MS),
      },
    });
    return { token, usuarioId: dueno.id, creado: dueno.creado, proposito: dueno.proposito };
  }, OPCIONES_TX);
}

export interface DatosDefinir {
  readonly token: string;
  readonly clave: string;
  readonly ip: string | null;
  readonly ahora: Date;
}

export type Definicion =
  | { readonly ok: true; readonly usuarioId: string }
  | { readonly ok: false; readonly motivo: "TOKEN_INVALIDO" | "CLAVE_INVALIDA" | "IP_LIMITADA" };

interface FilaToken {
  readonly id: string;
  readonly usuarioId: string;
  readonly vigente: boolean;
}

/** El token si existe; `vigente` = sin usar, sin vencer, el más reciente de su usuario y de un DUENO. */
async function tokenBloqueado(tx: Tx, tokenHash: string, ahora: Date): Promise<FilaToken | null> {
  const filas = await tx.$queryRaw<FilaToken[]>`
    SELECT t."id", t."usuarioId",
      (t."usadoEn" IS NULL AND t."venceEn" > ${ahora.toISOString()}::timestamptz AND u."rol" = 'DUENO'
       AND NOT EXISTS (
         SELECT 1 FROM "token_acceso" t2
         WHERE t2."usuarioId" = t."usuarioId" AND (t2."creadoEn", t2."id") > (t."creadoEn", t."id"))) AS "vigente"
    FROM "token_acceso" t JOIN "usuario" u ON u."id" = t."usuarioId"
    WHERE t."tokenHash" = ${tokenHash}
    FOR UPDATE OF t`;
  return filas[0] ?? null;
}

async function aplicar(tx: Tx, datos: DatosDefinir, tokenHash: string | null, claveHash: string): Promise<Definicion> {
  const red = redDeIp(datos.ip);
  await bloquearRed(tx, red);
  if ((await fallosDeIp(tx, red, datos.ahora)) >= FALLOS_POR_IP) return { ok: false, motivo: "IP_LIMITADA" };
  const fila = tokenHash ? await tokenBloqueado(tx, tokenHash, datos.ahora) : null;
  if (!fila?.vigente) {
    await tx.intentoIngreso.create({ data: { usuarioId: fila?.usuarioId ?? null, ip: datos.ip, resultado: "TOKEN_INVALIDO", ocurridoEn: datos.ahora } });
    return { ok: false, motivo: "TOKEN_INVALIDO" };
  }
  await tx.usuario.update({ where: { id: fila.usuarioId }, data: { claveHash, sesionVersion: { increment: 1 }, bloqueadoHasta: null } });
  await tx.tokenAcceso.update({ where: { id: fila.id }, data: { usadoEn: datos.ahora } });
  await tx.intentoIngreso.create({ data: { usuarioId: fila.usuarioId, ip: datos.ip, resultado: "CLAVE_DEFINIDA", ocurridoEn: datos.ahora } });
  return { ok: true, usuarioId: fila.usuarioId };
}

export async function definirClave(db: PrismaClient, datos: DatosDefinir): Promise<Definicion> {
  // Una clave inválida no gasta el enlace ni cuenta como intento: la política es pública.
  if (!largoValido(datos.clave)) return { ok: false, motivo: "CLAVE_INVALIDA" };
  if ((await fallosDeIp(db, redDeIp(datos.ip), datos.ahora)) >= FALLOS_POR_IP) return { ok: false, motivo: "IP_LIMITADA" };
  // bcrypt (~200 ms) fuera de la transacción; se calcula también con un token inválido.
  const claveHash = await hashClave(datos.clave);
  const tokenHash = formaDeToken(datos.token) ? hashToken(datos.token) : null;
  return db.$transaction((tx) => aplicar(tx, datos, tokenHash, claveHash), OPCIONES_TX);
}
