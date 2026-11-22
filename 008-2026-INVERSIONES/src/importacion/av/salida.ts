/**
 * Lo que hace y dice el CLI de importación de la certificación: importa, concilia si quedó cargada e indica el
 * siguiente paso. Si la certificación quedó guardada y lo que falla es la conciliación, lo dice así (no «la
 * importación falló»): el reintento sería idempotente, pero el dueño debe saber que ya está cargada.
 * Si se rechazó porque la fecha de corte no es día hábil, dice el último día hábil anterior según calendario_bvc y
 * cómo correrlo de nuevo; nunca reimporta con otra fecha por su cuenta.
 * Si se rechazó porque la fecha no es el corte real (el resultado trae `pistaCorte`), dice por qué, el día que sugiere
 * y el comando para repetir; si ese mismo PDF ya está cargado (`yaCargadaEn`), manda a corregir el corte
 * (`corregir-corte-certificacion`) en vez de reimportar, que daría ARCHIVO_YA_CARGADO.
 * Las líneas llevan solo conteos, códigos, la fecha de corte que dio el dueño y la de calendario_bvc; nunca cifras,
 * especies ni cuentas.
 */
import type { PrismaClient } from "@prisma/client";
import { conciliarCertificacion, type ResumenConciliacion } from "../../conciliacion/conciliar";
import { HORA_BARRA_DEFINITIVA_COT } from "../../precios/horario";
import { diaYHoraEnColombia, isoDia, leerCalendarioCorte, MAX_DIAS_ANTES_DEL_PDF, ultimoHabilAnterior, type CalendarioCorte, type PistaCorte, type UltimoHabil } from "./fecha-corte";
import type { ResultadoCorreccion } from "./corregir";
import { importarCertificacion, type ArchivoCertificacion, type ResultadoImportacionAv } from "./importar";

export interface Pasos {
  readonly importar: (db: PrismaClient, a: ArchivoCertificacion) => Promise<ResultadoImportacionAv>;
  readonly conciliar: (db: PrismaClient, o: { readonly fechaCorte: Date }) => Promise<ResumenConciliacion>;
  /** El calendario de la BVC, solo si la fecha de corte no es hábil. Sin él, se lee calendario_bvc. */
  readonly calendario?: (db: PrismaClient) => Promise<CalendarioCorte>;
}

const PASOS: Pasos = { importar: importarCertificacion, conciliar: conciliarCertificacion, calendario: leerCalendarioCorte };

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

/** La línea de la conciliación y, si sugiere otro corte, cómo corregirlo (nunca lo corrige sola). */
export function lineasDeConciliacion(c: ResumenConciliacion, produccion = false): string[] {
  if (c.corteSugerido === null) return [lineaDeConciliacion(c)];
  const s = c.corteSugerido;
  return [
    lineaDeConciliacion(c),
    `📅 Los precios de valoración cuadran con los cierres del ${s}, el día hábil anterior al corte: la certificación parece ser al cierre del ${s}, y el corte no se corrige solo. Si es así, ${corregirCorte(c.fechaCorte, s, produccion)}.`,
  ];
}

const nombreDe = (e: unknown) => (e instanceof Error ? e.name : "error");

/** Dónde corre: en producción no hay red y los pasos van por cargar-prod.sh (vía B, docs/despliegue/produccion.md §11). */
export interface OpcionesSalida {
  readonly produccion?: boolean;
}

/** Cómo volver a conciliar y cómo traer los cierres del día de corte (texto ya con sus comillas de código), en local o en producción. */
function pasosSiguientes(corte: string, produccion: boolean): { readonly reconciliar: string; readonly siguiente: string } {
  if (produccion) {
    const reconciliar = `\`cargar-prod.sh conciliar-certificacion\` con la cabecera \`--fecha-corte ${corte}\``;
    return {
      reconciliar,
      siguiente: `➡️  Siguiente paso (vía B, §11 del runbook): cargue los cierres con \`cargar-prod.sh importar-precios\` (el CSV de precios:exportar del Mac, que cubra ${corte}) y después ${reconciliar}.`,
    };
  }
  const reconciliar = `\`npx tsx scripts/conciliar-certificacion.ts --fecha-corte ${corte}\``;
  return { reconciliar, siguiente: `➡️  Siguiente paso: corra \`npm run precios:actualizar -- --desde ${corte}\` para verificar los cierres de ese día, y después ${reconciliar}.` };
}

/** Cómo correr de nuevo la importación con otra fecha de corte (texto ya con sus comillas de código), en local o en producción. */
function reimportar(corte: string, produccion: boolean): string {
  if (produccion) return `corra de nuevo \`cargar-prod.sh importar-certificacion\` con el mismo PDF y, en la cabecera, \`--fecha-corte ${corte}\` (con el mismo \`--fondo\`, si lo dio)`;
  return `corra de nuevo \`npx tsx scripts/importar-certificacion.ts --email <correo-del-dueño> --fecha-corte ${corte} [--fondo <codigoFic>] <certificacion.pdf>\` (con el mismo \`--fondo\`, si lo dio)`;
}

/** Cómo corregir el corte de una certificación ya cargada (texto ya con sus comillas de código), en local o en producción. */
export function corregirCorte(actual: string, nuevo: string, produccion: boolean): string {
  if (produccion) return `corrija el corte con \`cargar-prod.sh corregir-corte-certificacion\` con el mismo PDF y, en la cabecera, \`--fecha-corte ${actual}\` y \`--nueva-fecha-corte ${nuevo}\` (con \`--email\`)`;
  return `corrija el corte con \`npx tsx scripts/corregir-corte-certificacion.ts --email <correo-del-dueño> --fecha-corte ${actual} --nueva-fecha-corte ${nuevo} <certificacion.pdf>\` (el mismo PDF)`;
}

const dosCifras = (n: number) => String(n).padStart(2, "0");
const HORA_DEFINITIVA = `${dosCifras(HORA_BARRA_DEFINITIVA_COT.hora)}:${dosCifras(HORA_BARRA_DEFINITIVA_COT.minuto)}`;

/** El paso siguiente con el día sugerido: reimportar, o corregir el corte si ese PDF ya está cargado. */
function lineaDeRepetir(sugerido: string, yaCargadaEn: string | null, produccion: boolean): string {
  if (yaCargadaEn !== null) {
    return `➡️  Ese PDF ya está cargado con el corte ${yaCargadaEn}: no lo reimporte (daría ARCHIVO_YA_CARGADO). Si la certificación de A&V es al cierre del ${sugerido}, ${corregirCorte(yaCargadaEn, sugerido, produccion)}.`;
  }
  return `➡️  Si la certificación de A&V es al cierre de ese día, ${reimportar(sugerido, produccion)}. La nueva corrida vuelve a validar la fecha: no posterior a la generación del PDF ni de más de ${MAX_DIAS_ANTES_DEL_PDF} días antes.`;
}

/** Qué decir cuando la CreationDate del PDF muestra que la fecha de corte dada no puede ser el corte real. */
function lineasDePistaPdf(corte: string, pista: Extract<PistaCorte, { tipo: "PDF" }>, yaCargadaEn: string | null, produccion: boolean): string[] {
  const g = diaYHoraEnColombia(pista.generadoEn);
  const aviso = g.dia === corte
    ? `📅 El PDF se generó el ${g.dia} a las ${g.hora} (hora de Colombia), antes de que el cierre de ese día fuera definitivo (${HORA_DEFINITIVA}): no puede ser la certificación al cierre del ${corte}, y la fecha de corte no se ajusta sola.`
    : `📅 La fecha de corte ${corte} es posterior al día en que se generó el PDF (${g.dia} a las ${g.hora}, hora de Colombia) y no se ajusta sola.`;
  if (!pista.sugerido.ok) return [aviso, `   calendario_bvc no cubre ${pista.sugerido.anioSinCalendario}: no se puede indicar el día; hay que sembrar ese año.`];
  return [aviso, `   Según calendario_bvc, el último día hábil con el cierre ya definitivo a esa hora es ${pista.sugerido.dia}.`, lineaDeRepetir(pista.sugerido.dia, yaCargadaEn, produccion)];
}

/** Qué decir de una fecha de corte no hábil: el último día hábil anterior de calendario_bvc, o que su año no está sembrado. */
function lineasDeCorteNoHabil(corte: string, ultimo: UltimoHabil, produccion: boolean): string[] {
  const aviso = `📅 La fecha de corte ${corte} no es día hábil de la BVC y no se ajusta sola.`;
  if (!ultimo.ok) return [`${aviso} calendario_bvc no cubre ${ultimo.anioSinCalendario}: no se puede indicar el último día hábil anterior; hay que sembrar ese año.`];
  return [
    `${aviso} Según calendario_bvc, el último día hábil anterior es ${ultimo.dia}.`,
    lineaDeRepetir(ultimo.dia, null, produccion),
  ];
}

/** Por qué la fecha no es el corte real (si el resultado lo trae) o, si no es hábil, el último día hábil anterior. */
function lineasDePista(corte: string, pista: PistaCorte, yaCargadaEn: string | null, produccion: boolean): string[] {
  if (pista.tipo === "PDF") return lineasDePistaPdf(corte, pista, yaCargadaEn, produccion);
  return [
    `📅 Los precios de valoración de la certificación cuadran (±1 %) con los cierres del ${pista.sugerido}, el día hábil anterior al corte, en las ${pista.especies} especies, y en ${pista.distintas} no cuadran con los del ${corte}: es la foto del cierre del ${pista.sugerido}, y la fecha de corte no se ajusta sola.`,
    lineaDeRepetir(pista.sugerido, yaCargadaEn, produccion),
  ];
}

/** Si el rechazo trae la pista del corte real, la dice; si fue por la fecha no hábil, lee el calendario y dice el día hábil anterior. */
async function pistaDeCorte(db: PrismaClient, r: ResultadoImportacionAv, fechaCorte: Date, pasos: Pasos, produccion: boolean): Promise<string[]> {
  if (r.pistaCorte) return lineasDePista(isoDia(fechaCorte), r.pistaCorte, r.yaCargadaEn ?? null, produccion);
  if (!r.errores.some((e) => e.codigo === "FECHA_CORTE_NO_HABIL")) return [];
  try {
    const calendario = await (pasos.calendario ?? leerCalendarioCorte)(db);
    return lineasDeCorteNoHabil(isoDia(fechaCorte), ultimoHabilAnterior(fechaCorte, calendario), produccion);
  } catch (e) {
    return [`⚠️  No se pudo leer calendario_bvc para indicar el último día hábil anterior (${nombreDe(e)}): corra de nuevo con un día hábil de la BVC.`];
  }
}

/** Por qué se rechazó la corrección del corte, para los códigos propios (los de fecha y precios los explica la pista). */
function porQueNoSeCorrigio(codigo: string, actual: string, nuevo: string): string | null {
  const frases: Readonly<Record<string, string>> = {
    SIN_CERTIFICACION: `No hay certificación con el corte ${actual}: no hay nada que corregir.`,
    CORTE_RETIRADO: `La certificación del ${actual} ya se retiró (se corrigió antes): la vigente es la de su corte real.`,
    ARCHIVO_DISTINTO: `El PDF no es el mismo archivo que se cargó con el corte ${actual} (otro sha256): use el mismo PDF.`,
    CORTE_OCUPADO: `Ya hay una certificación con el corte ${nuevo}: no se reemplaza.`,
    ARCHIVO_YA_CARGADO: `Ese PDF también está cargado con un corte distinto del ${actual}: no se corrige solo; avise al CEO de 008.`,
    MISMA_FECHA: "Las dos fechas son la misma: no hay nada que corregir.",
  };
  return frases[codigo] ?? null;
}

/**
 * Lo que dice el CLI de corrección del corte: qué se retiró y qué quedó, los cierres re-verificados de cada día y el
 * siguiente paso (conciliar el corte nuevo); o el rechazo, por qué y que nada cambió. Solo conteos, códigos y fechas.
 */
export function lineasDeCorreccion(r: ResultadoCorreccion, actual: string, nuevo: string, produccion: boolean): string[] {
  if (r.estado === "CORREGIDO") {
    const { reconciliar } = pasosSiguientes(nuevo, produccion);
    return [
      `✅ CORREGIDO · la certificación del ${actual} se retiró y quedó cargada con el corte ${nuevo} (${r.filas} filas; ${r.cargasRevertidas} carga(s) del ${actual} en REVERTIDO). Lo anterior queda como historia.`,
      `🔁 Cierres re-verificados: ${r.reverificados.anterior} del ${actual} (quedan sin referencia) y ${r.reverificados.nuevo} del ${nuevo} (contra la certificación).`,
      `➡️  Siguiente paso: corra ${reconciliar}.`,
    ];
  }
  const codigo = r.codigo ?? "ERROR";
  const frase = porQueNoSeCorrigio(codigo, actual, nuevo);
  return [
    `❌ RECHAZADO (nada cambió) · ${codigo}`,
    ...(frase === null ? [] : [`   ${frase}`]),
    ...(r.pistaCorte === null ? [] : lineasDePista(nuevo, r.pistaCorte, actual, produccion)),
  ];
}

export async function cargarYConciliar(db: PrismaClient, a: ArchivoCertificacion, pasos: Pasos = PASOS, opciones: OpcionesSalida = {}): Promise<{ lineas: string[]; codigo: 0 | 1 }> {
  const r = await pasos.importar(db, a);
  const lineas = lineasDeImportacion(r);
  if (r.estado === "RECHAZADO") return { lineas: [...lineas, ...(await pistaDeCorte(db, r, a.fechaCorte, pasos, opciones.produccion ?? false))], codigo: 1 };
  const { reconciliar, siguiente } = pasosSiguientes(isoDia(a.fechaCorte), opciones.produccion ?? false);
  try {
    lineas.push(...lineasDeConciliacion(await pasos.conciliar(db, { fechaCorte: a.fechaCorte }), opciones.produccion ?? false));
  } catch (e) {
    lineas.push(`⚠️  La certificación quedó cargada, pero la conciliación falló (${nombreDe(e)}): corra ${reconciliar}.`);
    return { lineas, codigo: 1 };
  }
  lineas.push(siguiente);
  return { lineas, codigo: 0 };
}
