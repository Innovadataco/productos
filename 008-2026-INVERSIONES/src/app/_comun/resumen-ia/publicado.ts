import "server-only";
/**
 * El PUBLICADO más reciente de un tipo y un día exacto, de SOLO LECTURA, para la pantalla (inv_app hace SELECT).
 * Es la misma lectura que `ultimoPublicado` de src/ia/registro/registro.ts (E3), aquí aparte porque ese módulo también
 * escribe (`registrarResumen`) y una pantalla de lectura no debe alcanzar un módulo que escribe (candado
 * tests/unit/auth/escrituras.candado.test.ts: la familia entra en solo lectura). Mismo `where`, mismo orden y la misma
 * reconstrucción del paquete con `leerPaquete`; si lo guardado no cuadra, ErrorRegistro GUARDADO_INVALIDO. Que las dos
 * lecturas lean lo mismo lo prueba la integración (tests/integracion/resumen-ia-pantalla.test.ts) sobre filas escritas
 * con `registrarResumen`.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { TIPOS_RESUMEN, type DiaIso, type PaqueteHechos, type TipoResumen } from "@/ia/contrato";
import { esDe, esDiaIso } from "@/ia/formas";
import { ErrorPaquete, leerPaquete } from "@/ia/paquete";
import { diaDeFecha, ErrorRegistro, fechaDeDia } from "@/ia/registro/fila";
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

export async function publicadoDelDia(db: Pick<PrismaClient, "resumenIa">, tipo: TipoResumen, dia: DiaIso): Promise<ResumenPublicado | null> {
  if (!esDe(TIPOS_RESUMEN, tipo) || typeof dia !== "string" || !esDiaIso(dia)) throw new ErrorRegistro("CLAVE_INVALIDA");
  const fila = await db.resumenIa.findFirst({
    where: { estado: "PUBLICADO", tipo, fechaNegocio: fechaDeDia(dia) },
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
