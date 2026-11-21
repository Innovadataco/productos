/**
 * `importar-valores-fondo` (vía B del runbook, producción sin red): guarda los valores de unidad del CSV que exportó
 * el Mac por el MISMO camino que `actualizar-fondo` (`guardarValoresDeFondos`, en guardar.ts): mismos fondos (FIC
 * activos con código de la SFC), versionado, lotes con reintento, fuente `sfc:qhpu-8ixx` y último dato de cada fondo.
 * Recibe el CSV ya leído y validado (csv-valores.ts): todo o nada.
 * - Un código del CSV sin fondo FIC activo no escribe nada y se informa por su primera línea (FONDO_NO_REGISTRADO):
 *   se registra antes con `registrar-fondo`.
 * - La clase del CSV es la que pidió el exportador. Si no es la clase vigente registrada del fondo (o una de las dos
 *   falta), esos valores no son los que usaría `actualizar-fondo` y no se escriben (CLASE_DISTINTA, como fallo del
 *   fondo). La vigencia se mira a la última fecha del CSV, pero nunca después de hoy.
 * - «Todo o nada» es la VALIDACIÓN del CSV. La escritura es por lotes (como en actualizar-fondo): si el proceso muere a
 *   mitad, queda lo guardado hasta ahí, y volver a correr el mismo CSV completa sin duplicar.
 */
import type { PrismaClient } from "@prisma/client";
import { fechaEnBogota } from "../precios/horario";
import { claseVigente } from "./clase";
import type { FondoCsv, LecturaCsvFondo } from "./csv-valores";
import { dondeFondos, guardarValoresDeFondos, type FondoAGuardar, type ResultadoFondo } from "./guardar";
import type { ResultadoSfc } from "./sfc";

export type LecturaValidaFondo = Extract<LecturaCsvFondo, { readonly ok: true }>;

export interface FondoSinGuardar {
  readonly linea: number;
  readonly codigo: "FONDO_NO_REGISTRADO";
}

export interface ResultadoImportacionFondo {
  readonly filas: number;
  readonly fondosCsv: number;
  readonly sinFondo: readonly FondoSinGuardar[];
  readonly guardado: ResultadoFondo;
}

/** Los valores del CSV, solo si su clase es la clase vigente registrada del fondo. */
async function delCsv(db: PrismaClient, instrumentoId: string, f: FondoCsv, vigencia: Date): Promise<ResultadoSfc> {
  const clase = await claseVigente(db, instrumentoId, vigencia);
  return clase === f.participacion ? { ok: true, valores: [...f.valores], descartados: 0 } : { ok: false, codigo: "CLASE_DISTINTA" };
}

export async function importarValoresFondo(db: PrismaClient, csv: LecturaValidaFondo, opciones: { readonly ahora: Date }): Promise<ResultadoImportacionFondo> {
  const codigos = csv.fondos.map((f) => f.codigoFic);
  const instrumentos = await db.instrumento.findMany({ where: { ...dondeFondos(), codigoFic: { in: codigos } }, select: { id: true, codigoFic: true } });
  const idDe = new Map(instrumentos.map((i) => [i.codigoFic, i.id]));
  const sinFondo = csv.fondos.filter((f) => !idDe.has(f.codigoFic)).map((f) => ({ linea: f.primeraLinea, codigo: "FONDO_NO_REGISTRADO" as const }));
  const hoy = fechaEnBogota(opciones.ahora);
  const vigencia = csv.hasta < hoy ? csv.hasta : hoy;
  const fuentes: FondoAGuardar[] = csv.fondos.flatMap((f) => {
    const instrumentoId = idDe.get(f.codigoFic);
    return instrumentoId ? [{ instrumentoId, traer: () => delCsv(db, instrumentoId, f, vigencia) }] : [];
  });
  const guardado = await guardarValoresDeFondos(db, fuentes, { hasta: csv.hasta });
  return { filas: csv.filas, fondosCsv: csv.fondos.length, sinFondo, guardado };
}
