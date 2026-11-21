/**
 * Inicio de sesión con bloqueo (D-014, PLAN-DESPLIEGUE-VPS §6).
 * - 5 fallos de clave de una cuenta en 15 min la bloquean 15 min (`Usuario.bloqueadoHasta`).
 * - 20 fallos de una IP (IPv6: su /64) en 15 min cortan esa IP; esos intentos ya no se registran,
 *   para que un ataque no haga crecer la tabla sin fin.
 * - Cada intento queda en `intento_ingreso` (solo inserción), sin el correo tecleado ni la clave.
 * bcrypt corre FUERA de la transacción (dura ~200 ms) y siempre, contra el hash real o el señuelo.
 * Después, una transacción corta serializa por IP (advisory lock) y por cuenta (FOR UPDATE), en ese
 * orden siempre, vuelve a contar y decide: dos intentos simultáneos no pasan los dos el tope.
 *
 * RIESGO ACEPTADO (security-reviewer y code-reviewer, GATE 2): cualquiera que conozca el correo del dueño
 * puede mantener su cuenta bloqueada con 5 fallos cada 15 min desde IP que rotan. Se acota así: el
 * bloqueo no se alarga con más intentos (los de durante el bloqueo no cuentan) y la recuperación es
 * `scripts/crear-acceso-inicial.ts`, cuyo enlace, al usarse, limpia `bloqueadoHasta`.
 */
import type { Prisma, PrismaClient, ResultadoIngreso } from "@prisma/client";
import { compararClave } from "./clave";
import { redDeIp } from "./ip";
import { BLOQUEO_MS, FALLOS_POR_IP, FALLOS_POR_USUARIO, VENTANA_FALLOS_MS } from "./limites";
import { OPCIONES_TX, bloquearRed, fallosDeIp } from "./topes";

export interface DatosIngreso {
  readonly email: string;
  readonly clave: string;
  /** IP del cliente ya validada (`ipDeSolicitud`), o null. */
  readonly ip: string | null;
  readonly ahora: Date;
}

export type Ingreso =
  | { readonly ok: true; readonly usuarioId: string; readonly sesionVersion: number }
  | { readonly ok: false; readonly motivo: ResultadoIngreso | "IP_LIMITADA" };

interface FilaUsuario {
  readonly id: string;
  readonly rol: string;
  readonly activo: boolean;
  readonly claveHash: string | null;
  readonly bloqueadoHasta: Date | null;
  readonly sesionVersion: number;
}

type Tx = Prisma.TransactionClient;

const ROL_PERMITIDO = "DUENO";

async function bloquearFila(tx: Tx, email: string): Promise<FilaUsuario | null> {
  const filas = await tx.$queryRaw<FilaUsuario[]>`
    SELECT "id", "rol"::text AS "rol", "activo", "claveHash", "bloqueadoHasta", "sesionVersion"
    FROM "usuario" WHERE "email" = ${email}::citext FOR UPDATE`;
  return filas[0] ?? null;
}

/** El resultado, en orden: existe, tiene clave, no está bloqueada, clave correcta, activa y rol. */
function decidir(fila: FilaUsuario | null, claveOk: boolean, ahora: Date): ResultadoIngreso {
  if (!fila) return "USUARIO_INEXISTENTE";
  if (fila.claveHash === null) return "SIN_CLAVE";
  if (fila.bloqueadoHasta && fila.bloqueadoHasta > ahora) return "CUENTA_BLOQUEADA";
  if (!claveOk) return "CLAVE_INCORRECTA";
  if (!fila.activo) return "CUENTA_INACTIVA";
  if (fila.rol !== ROL_PERMITIDO) return "ROL_NO_PERMITIDO";
  return "EXITO";
}

/**
 * Fallos de clave que cuentan: desde lo más reciente entre la ventana, el último éxito (o clave definida
 * con un enlace) y el fin del bloqueo anterior.
 */
async function fallosDeCuenta(tx: Tx, fila: FilaUsuario, ahora: Date): Promise<number> {
  const ultimoExito = await tx.intentoIngreso.findFirst({
    where: { usuarioId: fila.id, resultado: { in: ["EXITO", "CLAVE_DEFINIDA"] } },
    orderBy: { ocurridoEn: "desc" },
    select: { ocurridoEn: true },
  });
  const finBloqueo = fila.bloqueadoHasta && fila.bloqueadoHasta <= ahora ? fila.bloqueadoHasta.getTime() : 0;
  const desde = Math.max(ahora.getTime() - VENTANA_FALLOS_MS, ultimoExito?.ocurridoEn.getTime() ?? 0, finBloqueo);
  return tx.intentoIngreso.count({ where: { usuarioId: fila.id, resultado: "CLAVE_INCORRECTA", ocurridoEn: { gt: new Date(desde) } } });
}

async function registrar(tx: Tx, datos: DatosIngreso, hashComparado: string | null, claveOk: boolean): Promise<Ingreso> {
  const red = redDeIp(datos.ip);
  await bloquearRed(tx, red);
  if ((await fallosDeIp(tx, red, datos.ahora)) >= FALLOS_POR_IP) return { ok: false, motivo: "IP_LIMITADA" };

  const fila = await bloquearFila(tx, datos.email);
  // Si la clave cambió entre la comparación y el bloqueo de la fila, la comparación ya no vale.
  const resultado = decidir(fila, claveOk && fila?.claveHash === hashComparado, datos.ahora);
  await tx.intentoIngreso.create({ data: { usuarioId: fila?.id ?? null, ip: datos.ip, resultado, ocurridoEn: datos.ahora } });

  if (fila && resultado === "CLAVE_INCORRECTA" && (await fallosDeCuenta(tx, fila, datos.ahora)) >= FALLOS_POR_USUARIO) {
    await tx.usuario.update({ where: { id: fila.id }, data: { bloqueadoHasta: new Date(datos.ahora.getTime() + BLOQUEO_MS) } });
  }
  if (fila && resultado === "EXITO") return { ok: true, usuarioId: fila.id, sesionVersion: fila.sesionVersion };
  return { ok: false, motivo: resultado };
}

/** Compara la clave con el hash leído. Se inyecta solo en pruebas (para simular un cambio de clave en medio). */
export type Comparador = (clave: string, hash: string | null) => Promise<boolean>;

export async function ingresar(db: PrismaClient, datos: DatosIngreso, comparar: Comparador = compararClave): Promise<Ingreso> {
  // Una IP ya cortada no gasta bcrypt ni escribe (se vuelve a contar dentro de la transacción).
  if ((await fallosDeIp(db, redDeIp(datos.ip), datos.ahora)) >= FALLOS_POR_IP) return { ok: false, motivo: "IP_LIMITADA" };
  const cuenta = await db.usuario.findUnique({ where: { email: datos.email }, select: { claveHash: true } });
  const hash = cuenta?.claveHash ?? null;
  const claveOk = await comparar(datos.clave, hash);
  return db.$transaction((tx) => registrar(tx, datos, hash, claveOk), OPCIONES_TX);
}
