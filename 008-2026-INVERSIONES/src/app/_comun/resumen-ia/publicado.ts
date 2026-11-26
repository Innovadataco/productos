import "server-only";
/**
 * El PUBLICADO más reciente de un tipo (de cualquier día: la tarjeta muestra el último análisis válido con su fecha) y el
 * último RECHAZADO por el validador y el último FALLIDO, de SOLO LECTURA, para la pantalla (inv_app hace SELECT).
 * Es la misma lectura que `ultimoPublicado` de src/ia/registro/registro.ts (E3), aquí aparte porque ese módulo también
 * escribe (`registrarResumen`) y una pantalla de lectura no debe alcanzar un módulo que escribe (candado
 * tests/unit/auth/escrituras.candado.test.ts: la familia entra en solo lectura). Mismo `where`, mismo orden y la misma
 * reconstrucción del paquete con `leerPaquete`; si lo guardado no cuadra, ErrorRegistro GUARDADO_INVALIDO. Que las dos
 * lecturas lean lo mismo lo prueba la integración (tests/integracion/resumen-ia-pantalla.test.ts) sobre filas escritas
 * con `registrarResumen`.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { TIPOS_RESUMEN, type PaqueteHechos, type TipoResumen } from "@/ia/contrato";
import { esDe } from "@/ia/formas";
import { ErrorPaquete, leerPaquete } from "@/ia/paquete";
import { diaDeFecha, ErrorRegistro, MOTIVO_YA_PUBLICADO } from "@/ia/registro/fila";
import type { ResumenPublicado } from "@/ia/registro/registro";

const SELECCION = Object.freeze({
  id: true, tipo: true, fechaNegocio: true, puerta: true, texto: true, salidaModelo: true, hechos: true, hechosHash: true, promptVersion: true,
  promptHash: true, modelo: true, modeloDigest: true, validadorVersion: true, generadoEn: true,
} as const);
type Fila = Prisma.ResumenIaGetPayload<{ select: typeof SELECCION }>;

function paqueteDe(fila: Fila): PaqueteHechos {
  let paquete: PaqueteHechos;
  try {
    paquete = leerPaquete(fila.hechos);
  } catch (error) {
    if (error instanceof ErrorPaquete) throw new ErrorRegistro("GUARDADO_INVALIDO");
    throw error;
  }
  if (paquete.hash !== fila.hechosHash || paquete.tipo !== fila.tipo || paquete.hoy !== diaDeFecha(fila.fechaNegocio)) throw new ErrorRegistro("GUARDADO_INVALIDO");
  return paquete;
}

export async function ultimoPublicadoDe(db: Pick<PrismaClient, "resumenIa">, tipo: TipoResumen): Promise<ResumenPublicado | null> {
  if (!esDe(TIPOS_RESUMEN, tipo)) throw new ErrorRegistro("CLAVE_INVALIDA");
  const fila = await db.resumenIa.findFirst({
    where: { estado: "PUBLICADO", tipo },
    orderBy: [{ generadoEn: "desc" }, { id: "desc" }],
    select: SELECCION,
  });
  if (fila === null) return null;
  const { puerta, texto, salidaModelo, modelo, modeloDigest } = fila;
  if (puerta === null || texto === null || salidaModelo === null || modelo === null || modeloDigest === null) throw new ErrorRegistro("GUARDADO_INVALIDO");
  return Object.freeze({
    id: fila.id, tipo: fila.tipo, fechaNegocio: diaDeFecha(fila.fechaNegocio), puerta, texto, salidaModelo, paquete: paqueteDe(fila),
    hechosHash: fila.hechosHash, promptVersion: fila.promptVersion, promptHash: fila.promptHash, modelo, modeloDigest,
    validadorVersion: fila.validadorVersion, generadoEn: fila.generadoEn,
  });
}

/** Lo que la tarjeta necesita de un análisis rechazado por el validador: cuándo fue y por qué (códigos; la pantalla los dice en palabras). */
export interface ResumenRechazado {
  readonly fechaNegocio: string;
  readonly motivos: readonly string[];
  readonly generadoEn: Date;
}

/**
 * El RECHAZADO más reciente de un tipo por el validador. Un RECHAZADO con YA_PUBLICADO no lo es: es el segundo de dos
 * corridas a la vez con los mismos hechos (registrarResumen), y de ese ya hay un PUBLICADO.
 */
export async function ultimoRechazadoDe(db: Pick<PrismaClient, "resumenIa">, tipo: TipoResumen): Promise<ResumenRechazado | null> {
  if (!esDe(TIPOS_RESUMEN, tipo)) throw new ErrorRegistro("CLAVE_INVALIDA");
  const fila = await db.resumenIa.findFirst({
    where: { estado: "RECHAZADO", tipo, NOT: { motivos: { has: MOTIVO_YA_PUBLICADO } } },
    orderBy: [{ generadoEn: "desc" }, { id: "desc" }],
    select: { fechaNegocio: true, motivos: true, generadoEn: true },
  });
  return fila === null ? null : Object.freeze({ fechaNegocio: diaDeFecha(fila.fechaNegocio), motivos: Object.freeze([...fila.motivos]), generadoEn: fila.generadoEn });
}

/** Lo que la tarjeta necesita de un intento FALLIDO (no hubo salida del modelo): cuándo fue; el motivo no se muestra. */
export interface ResumenFallido {
  readonly fechaNegocio: string;
  readonly generadoEn: Date;
}

/** El FALLIDO más reciente de un tipo (solo lectura: inv_app hace SELECT de toda resumen_ia, sin GRANT nuevo). */
export async function ultimoFallidoDe(db: Pick<PrismaClient, "resumenIa">, tipo: TipoResumen): Promise<ResumenFallido | null> {
  if (!esDe(TIPOS_RESUMEN, tipo)) throw new ErrorRegistro("CLAVE_INVALIDA");
  const fila = await db.resumenIa.findFirst({
    where: { estado: "FALLIDO", tipo },
    orderBy: [{ generadoEn: "desc" }, { id: "desc" }],
    select: { fechaNegocio: true, generadoEn: true },
  });
  return fila === null ? null : Object.freeze({ fechaNegocio: diaDeFecha(fila.fechaNegocio), generadoEn: fila.generadoEn });
}
