/**
 * Registro idempotente del fondo (FIC) que se valora con la SFC.
 * - `codigoFic` es el `codigo_negocio` de la SFC, tal cual (no cambia de sentido).
 * - La clase (`tipo_participacion`) va en `SimboloPrecio` con proveedor `sfc:qhpu-8ixx`, como la
 *   equivalencia de símbolos de los precios. Una clase vigente distinta no se cambia en silencio.
 * - Repetir el registro reutiliza lo que ya existe. Dos registros a la vez se serializan con un candado
 *   consultivo de transacción por código de negocio (sin migración). Los datos reales solo viven en la base del dueño.
 */
import type { PrismaClient } from "@prisma/client";
import { claseVigente } from "./clase";
import { CODIGO_FIC_RE, FUENTE_SFC, PARTICIPACION_RE } from "./sfc";

/** La serie de la SFC empieza en 2016: la clase registrada rige desde ahí. */
const INICIO_SERIE_SFC = new Date(Date.UTC(2016, 0, 1));
const NOMBRE_MAXIMO = 120;
/**
 * Lo que el nombre no admite: controles (C0, DEL y C1), caracteres de formato invisibles (bidi, ancho cero, BOM) y
 * separadores de línea o de párrafo. Confunden la pantalla y los reportes.
 */
const NOMBRE_PROHIBIDO = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const MAX_INTENTOS_REGISTRO = 2;

export interface DatosRegistroFondo {
  readonly codigo: string;
  readonly participacion: string | null;
  readonly nombre: string;
}

export interface ErrorCampo {
  readonly campo: string;
  readonly codigo: string;
}

export type ResultadoValidacion = { ok: true; valor: DatosRegistroFondo } | { ok: false; errores: ErrorCampo[] };

export interface ResultadoRegistro {
  readonly instrumentoId: string;
  readonly fondoCreado: boolean;
  readonly clase: "creada" | "existente" | "no_indicada";
}

/** Rechazo de negocio: solo lleva un código, nunca datos del fondo. */
export class ErrorRegistroFondo extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
    this.name = "ErrorRegistroFondo";
  }
}

export function validarRegistroFondo(entrada: { codigo?: string | undefined; participacion?: string | undefined; nombre?: string | undefined }): ResultadoValidacion {
  const errores: ErrorCampo[] = [];
  const codigo = entrada.codigo ?? "";
  const nombre = (entrada.nombre ?? "").trim();
  if (!CODIGO_FIC_RE.test(codigo)) errores.push({ campo: "codigo", codigo: "CODIGO_FIC_FORMATO" });
  if (entrada.participacion !== undefined && !PARTICIPACION_RE.test(entrada.participacion)) errores.push({ campo: "participacion", codigo: "PARTICIPACION_FORMATO" });
  if (nombre.length === 0 || nombre.length > NOMBRE_MAXIMO || NOMBRE_PROHIBIDO.test(nombre)) errores.push({ campo: "nombre", codigo: "NOMBRE_FORMATO" });
  if (errores.length > 0) return { ok: false, errores };
  return { ok: true, valor: { codigo, participacion: entrada.participacion ?? null, nombre } };
}

type Transaccion = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function fondoDe(tx: Transaccion, datos: DatosRegistroFondo): Promise<{ id: string; creado: boolean }> {
  const existente = await tx.instrumento.findUnique({ where: { codigoFic: datos.codigo }, select: { id: true, tipo: true, activo: true } });
  if (existente && existente.tipo !== "FIC") throw new ErrorRegistroFondo("CODIGO_FIC_EN_USO");
  if (existente && !existente.activo) throw new ErrorRegistroFondo("FONDO_INACTIVO");
  if (existente) return { id: existente.id, creado: false };
  const nuevo = await tx.instrumento.create({ data: { tipo: "FIC", codigoFic: datos.codigo, nombre: datos.nombre }, select: { id: true } });
  return { id: nuevo.id, creado: true };
}

async function claseDe(tx: Transaccion, instrumentoId: string, participacion: string | null, hoy: Date): Promise<ResultadoRegistro["clase"]> {
  if (participacion === null) return "no_indicada";
  const vigente = await claseVigente(tx, instrumentoId, hoy);
  if (vigente !== null) {
    if (vigente !== participacion) throw new ErrorRegistroFondo("CLASE_DISTINTA");
    return "existente";
  }
  // Una clase cerrada o futura choca con la vigencia nueva: se dice con un código, no con un error de la base.
  if ((await tx.simboloPrecio.count({ where: { instrumentoId, proveedor: FUENTE_SFC } })) > 0) throw new ErrorRegistroFondo("CLASE_NO_VIGENTE");
  await tx.simboloPrecio.create({ data: { instrumentoId, proveedor: FUENTE_SFC, simbolo: participacion, vigenteDesde: INICIO_SERIE_SFC } });
  return "creada";
}

/** Choque con otra escritura: código único (P2002) o vigencias solapadas (exclusión, SQLSTATE 23P01). */
function esConflicto(e: unknown): boolean {
  if ((e as { code?: unknown } | null)?.code === "P2002") return true;
  // Prisma no le da código a la violación de exclusión: solo se mira el SQLSTATE, nunca se muestra el mensaje.
  return e instanceof Error && e.name === "PrismaClientUnknownRequestError" && /\b23P01\b/.test(e.message);
}

async function registrarEnTransaccion(db: PrismaClient, datos: DatosRegistroFondo, hoy: Date): Promise<ResultadoRegistro> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${`008:fondo-sfc:${datos.codigo}`}))`;
    const fondo = await fondoDe(tx, datos);
    const clase = await claseDe(tx, fondo.id, datos.participacion, hoy);
    return { instrumentoId: fondo.id, fondoCreado: fondo.creado, clase };
  });
}

/** Crea o reutiliza el fondo y, si se indica, su clase. Todo o nada. Un choque se relee una vez y, si sigue, es un código. */
export async function registrarFondo(db: PrismaClient, datos: DatosRegistroFondo, hoy: Date): Promise<ResultadoRegistro> {
  for (let intento = 1; ; intento += 1) {
    try {
      return await registrarEnTransaccion(db, datos, hoy);
    } catch (err) {
      if (!esConflicto(err)) throw err;
      if (intento >= MAX_INTENTOS_REGISTRO) throw new ErrorRegistroFondo("REGISTRO_EN_CONFLICTO");
    }
  }
}
