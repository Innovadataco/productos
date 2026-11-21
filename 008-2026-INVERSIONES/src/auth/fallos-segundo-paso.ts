/**
 * Fallos y bloqueo del segundo paso (TOTP, decisión D2 de la GATE 1). Quien llega aquí ya pasó la clave:
 * - 5 fallos (código errado, repetido o de recuperación inválido; también al enrolar o al regenerar los
 *   códigos) en 15 min bloquean la cuenta (`Usuario.bloqueadoHasta`, el mismo bloqueo de la clave).
 * - Un bloqueo que llega antes de 24 h del FIN del anterior dura el doble que ese: 15 min, 30, 60… hasta
 *   24 h, y se queda en 24 h mientras el ataque siga (medido desde el fin, nunca vuelve a bajar solo).
 *   La duración del anterior sale de su marca BLOQUEO_SEGUNDO_PASO (inicio) y de `bloqueadoHasta` (fin).
 * - Reinician el conteo y la cadena: un éxito del segundo paso, el enrolamiento, la regeneración de
 *   códigos, una clave definida con el enlace (CLAVE_DEFINIDA) y `--reiniciar-totp`. Volver a pasar la
 *   CLAVE no los reinicia: si no, quien la tiene podría probar 4 códigos, reingresar y seguir sin fin.
 * - El conteo de fallos arranca también al terminar el bloqueo anterior (los de antes ya lo causaron).
 * El bloqueo del paso de la clave sigue fijo en 15 min (src/auth/ingreso.ts). Si una cuenta tuvo además un
 * bloqueo de clave después del último del segundo paso, la duración «anterior» sale más larga: el error es
 * hacia más bloqueo, nunca hacia menos.
 */
import { Prisma, type ResultadoIngreso } from "@prisma/client";
import { BLOQUEO_MAX_MS, BLOQUEO_MS, FALLOS_SEGUNDO_PASO, VENTANA_BLOQUEOS_MS, VENTANA_FALLOS_MS } from "./limites";

type Tx = Prisma.TransactionClient;

export type FalloSegundoPaso = Extract<ResultadoIngreso, "TOTP_INCORRECTO" | "TOTP_REPETIDO" | "RECUPERACION_INVALIDA">;

/** A propósito TOTP_REPETIDO cuenta como fallo: probar un código ya usado es un intento más. */
const FALLOS: readonly FalloSegundoPaso[] = ["TOTP_INCORRECTO", "TOTP_REPETIDO", "RECUPERACION_INVALIDA"];
/** Los que reinician (los mismos del índice parcial `intento_ingreso_reinicio_totp_idx`). */
const REINICIAN = [
  "TOTP_EXITO",
  "RECUPERACION_USADA",
  "TOTP_ENROLADO",
  "CODIGOS_REGENERADOS",
  "TOTP_REINICIADO",
  "CLAVE_DEFINIDA",
] as const satisfies readonly ResultadoIngreso[];
/** 2^7 · 15 min ya pasa de 24 h: más bloqueos no cambian nada. */
const DOBLES_MAX = 7;

/** Como literales (constantes del código): así el planificador usa el índice parcial. */
const REINICIAN_SQL = Prisma.raw(
  REINICIAN.map((r) => {
    if (!/^[A-Z_]+$/.test(r)) throw new Error("Resultado inválido en la lista de reinicios.");
    return `'${r}'::"ResultadoIngreso"`;
  }).join(", "),
);

/** Duración del bloqueo de un nivel de la cadena: 15 min · 2^nivel, con tope de 24 h. */
export function duracionBloqueoSegundoPaso(nivel: number): number {
  if (Number.isNaN(nivel)) return BLOQUEO_MAX_MS;
  const k = Math.min(Math.max(0, Math.floor(nivel)), DOBLES_MAX);
  return Math.min(BLOQUEO_MS * 2 ** k, BLOQUEO_MAX_MS);
}

/** El nivel que corresponde a una duración ya aplicada (15 min → 0, 30 → 1… 24 h → 7). */
const nivelDeDuracion = (ms: number): number => Math.min(Math.max(0, Math.round(Math.log2(ms / BLOQUEO_MS))), DOBLES_MAX);

export interface CuentaConBloqueo {
  readonly id: string;
  readonly bloqueadoHasta: Date | null;
}

export const estaBloqueada = (cuenta: CuentaConBloqueo, ahora: Date): boolean => cuenta.bloqueadoHasta !== null && cuenta.bloqueadoHasta > ahora;

/** La consulta del último reinicio (se expone para verificar con EXPLAIN que usa su índice parcial). */
export const sqlUltimoReinicio = (usuarioId: string): Prisma.Sql => Prisma.sql`
    SELECT "ocurridoEn" FROM "intento_ingreso"
    WHERE "usuarioId" = ${usuarioId} AND "resultado" IN (${REINICIAN_SQL})
    ORDER BY "ocurridoEn" DESC LIMIT 1`;

async function ultimoReinicio(tx: Tx, usuarioId: string): Promise<number> {
  const filas = await tx.$queryRaw<{ ocurridoEn: Date }[]>(sqlUltimoReinicio(usuarioId));
  return filas[0]?.ocurridoEn.getTime() ?? 0;
}

/** El nivel del bloqueo nuevo: el siguiente al del anterior si este llega antes de 24 h de su fin; si no, 0. */
async function nivelDelBloqueo(tx: Tx, cuenta: CuentaConBloqueo, reinicio: number, ahora: Date): Promise<number> {
  const ultimo = await tx.intentoIngreso.findFirst({
    where: { usuarioId: cuenta.id, resultado: "BLOQUEO_SEGUNDO_PASO", ocurridoEn: { gt: new Date(reinicio) } },
    orderBy: { ocurridoEn: "desc" },
    select: { ocurridoEn: true },
  });
  const fin = cuenta.bloqueadoHasta?.getTime();
  if (!ultimo || fin === undefined || fin <= ultimo.ocurridoEn.getTime()) return 0;
  if (ahora.getTime() - fin >= VENTANA_BLOQUEOS_MS) return 0;
  return Math.min(nivelDeDuracion(fin - ultimo.ocurridoEn.getTime()) + 1, DOBLES_MAX);
}

/**
 * Un intento contra una cuenta bloqueada: se registra y, a propósito, cuenta para el tope por IP (seguir
 * probando contra una cuenta bloqueada también agota la IP); no alarga el bloqueo de la cuenta.
 */
export async function registrarBloqueada(tx: Tx, usuarioId: string, ip: string | null, ahora: Date): Promise<void> {
  await tx.intentoIngreso.create({ data: { usuarioId, ip, resultado: "CUENTA_BLOQUEADA", ocurridoEn: ahora } });
}

/** Registra el fallo y, si con él llegan a 5, bloquea la cuenta (el doble si sigue a otro) y deja la marca. */
export async function registrarFallo(tx: Tx, cuenta: CuentaConBloqueo, resultado: FalloSegundoPaso, ip: string | null, ahora: Date): Promise<void> {
  await tx.intentoIngreso.create({ data: { usuarioId: cuenta.id, ip, resultado, ocurridoEn: ahora } });
  const reinicio = await ultimoReinicio(tx, cuenta.id);
  const finBloqueo = cuenta.bloqueadoHasta && cuenta.bloqueadoHasta <= ahora ? cuenta.bloqueadoHasta.getTime() : 0;
  const desde = Math.max(ahora.getTime() - VENTANA_FALLOS_MS, reinicio, finBloqueo);
  const fallos = await tx.intentoIngreso.count({ where: { usuarioId: cuenta.id, resultado: { in: [...FALLOS] }, ocurridoEn: { gt: new Date(desde) } } });
  if (fallos < FALLOS_SEGUNDO_PASO) return;
  const nivel = await nivelDelBloqueo(tx, cuenta, reinicio, ahora);
  await tx.usuario.update({ where: { id: cuenta.id }, data: { bloqueadoHasta: new Date(ahora.getTime() + duracionBloqueoSegundoPaso(nivel)) } });
  await tx.intentoIngreso.create({ data: { usuarioId: cuenta.id, ip, resultado: "BLOQUEO_SEGUNDO_PASO", ocurridoEn: ahora } });
}
