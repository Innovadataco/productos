/**
 * Lo que hace y dice el CLI de importación de la certificación: importa, concilia si quedó cargada e indica el
 * siguiente paso. Si la certificación quedó guardada y lo que falla es la conciliación, lo dice así (no «la
 * importación falló»): el reintento sería idempotente, pero el dueño debe saber que ya está cargada.
 * Las líneas llevan solo conteos, códigos y la fecha de corte que dio el dueño; nunca cifras, especies ni cuentas.
 */
import type { PrismaClient } from "@prisma/client";
import { conciliarCertificacion, type ResumenConciliacion } from "../../conciliacion/conciliar";
import { isoDia } from "./fecha-corte";
import { importarCertificacion, type ArchivoCertificacion, type ResultadoImportacionAv } from "./importar";

export interface Pasos {
  readonly importar: (db: PrismaClient, a: ArchivoCertificacion) => Promise<ResultadoImportacionAv>;
  readonly conciliar: (db: PrismaClient, o: { readonly fechaCorte: Date }) => Promise<ResumenConciliacion>;
}

const PASOS: Pasos = { importar: importarCertificacion, conciliar: conciliarCertificacion };

export function lineasDeImportacion(r: ResultadoImportacionAv): string[] {
  if (r.estado === "RECHAZADO") {
    return [`❌ RECHAZADO (nada se guardó) · ${r.errores.length} error(es):`, ...r.errores.map((e) => `   página ${e.pagina} · fila ${e.fila}${e.columna ? ` · ${e.columna}` : ""} · ${e.codigo}`)];
  }
  const detalle = r.repetida
    ? "la misma certificación ya estaba cargada: 0 filas nuevas"
    : `${r.filasNuevas} filas nuevas, ${r.instrumentosCreados} especies nuevas${r.fondoVinculado ? ", fondo vinculado por su NIT" : ""}`;
  return [`✅ CARGADO · ${r.filasTotal} filas: ${detalle}`];
}

export function lineaDeConciliacion(c: ResumenConciliacion): string {
  const motivos = c.motivos.length ? ` · motivos: ${c.motivos.join(", ")}` : "";
  return `🧮 Conciliación al ${c.fechaCorte}: ${c.resultado} · ${c.cuentas.CUADRA} cuadran, ${c.cuentas.NO_CUADRA} no cuadran, ${c.cuentas.PENDIENTE_LIQUIDACION} pendientes de liquidación${motivos}`;
}

const nombreDe = (e: unknown) => (e instanceof Error ? e.name : "error");

export async function cargarYConciliar(db: PrismaClient, a: ArchivoCertificacion, pasos: Pasos = PASOS): Promise<{ lineas: string[]; codigo: 0 | 1 }> {
  const r = await pasos.importar(db, a);
  const lineas = lineasDeImportacion(r);
  if (r.estado === "RECHAZADO") return { lineas, codigo: 1 };
  const corte = isoDia(a.fechaCorte);
  const reconciliar = `npx tsx scripts/conciliar-certificacion.ts --fecha-corte ${corte}`;
  try {
    lineas.push(lineaDeConciliacion(await pasos.conciliar(db, { fechaCorte: a.fechaCorte })));
  } catch (e) {
    lineas.push(`⚠️  La certificación quedó cargada, pero la conciliación falló (${nombreDe(e)}): corra \`${reconciliar}\`.`);
    return { lineas, codigo: 1 };
  }
  lineas.push(`➡️  Siguiente paso: corra \`npm run precios:actualizar -- --desde ${corte}\` para verificar los cierres de ese día, y después \`${reconciliar}\`.`);
  return { lineas, codigo: 0 };
}
