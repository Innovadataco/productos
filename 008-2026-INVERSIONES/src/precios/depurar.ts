/**
 * Depuración de cierres de Yahoo ya guardados (SPEC-13 «nunca un precio viejo como de hoy»).
 * El código anterior guardaba barras de días no hábiles y de días sin negociación con el precio viejo.
 * Esto recorre los cierres VIGENTES de Yahoo del rango y, con la misma regla que la carga (`negociacion.ts`):
 * - día no hábil (fin de semana o festivo de calendario_bvc): sobra, sin preguntar a Yahoo;
 * - día hábil cuya barra de Yahoo trae volumen 0: sobra (sin negociación);
 * - año sin calendario o barra aún no definitiva: no se toca, solo se cuenta;
 * - si Yahoo falla para una especie, sus días hábiles no se tocan y se informa el código.
 * Sin `aplicar` es un ensayo: no escribe. Con `aplicar` exige que `base` sea la base conectada y retira
 * por id con guarda (`reemplazadoEn` sin sucesor; nada se borra). Solo devuelve conteos, códigos e ids internos.
 * El diagnóstico cuenta lo que prueba los supuestos de volumen antes de aplicar.
 */
import type { PrismaClient } from "@prisma/client";
import { FUENTE, leerCalendarioBvc, simboloDe } from "./actualizar";
import { motivoOmision, type CalendarioBvc } from "./negociacion";
import { obtenerCierres, type Buscar, type Cierre } from "./yahoo";

export interface VigenteYahoo {
  readonly id: string;
  readonly fecha: Date;
}

export interface ClasificacionEspecie {
  /** Ids a retirar por día no hábil. */
  readonly noHabil: readonly string[];
  /** Ids a retirar porque Yahoo trae volumen 0 ese día. */
  readonly sinNegociacion: readonly string[];
  readonly sinCalendario: number;
  readonly aunNoDefinitivos: number;
}

/** Puro. `barras` null = Yahoo falló: sin volumen, solo el calendario decide. */
export function clasificarVigentes(vigentes: readonly VigenteYahoo[], barras: readonly Cierre[] | null, ahora: Date, calendario: CalendarioBvc): ClasificacionEspecie {
  const volumenDe = new Map((barras ?? []).map((b) => [b.fecha.getTime(), b.volumen]));
  const motivos = vigentes.map((v) => ({ id: v.id, motivo: motivoOmision({ fecha: v.fecha, volumen: volumenDe.get(v.fecha.getTime()) ?? null }, ahora, calendario) }));
  const con = (m: string) => motivos.filter((x) => x.motivo === m);
  return {
    noHabil: con("NO_HABIL").map((x) => x.id),
    sinNegociacion: con("SIN_NEGOCIACION").map((x) => x.id),
    sinCalendario: con("SIN_CALENDARIO").length,
    aunNoDefinitivos: con("HORARIO").length,
  };
}

export interface Diagnostico {
  readonly barras: number;
  /** Barras con volumen 0 cuyo cierre difiere del anterior: contradicen «volumen 0 = sin negociación». */
  readonly sinNegociacionConCierreDistinto: number;
  /** Barras de día hábil con volumen null: se guardan sin saber si hubo negociación. */
  readonly habilesConVolumenNull: number;
}

/** Puro. `barras` en orden de fecha (como las entrega parsearYahoo). */
export function diagnosticar(barras: readonly Cierre[], ahora: Date, calendario: CalendarioBvc): Diagnostico {
  const distintos = barras.filter((b, i) => i > 0 && b.volumen === 0 && b.precio !== barras[i - 1]!.precio).length;
  const nulos = barras.filter((b) => b.volumen === null && motivoOmision(b, ahora, calendario) === null).length;
  return { barras: barras.length, sinNegociacionConCierreDistinto: distintos, habilesConVolumenNull: nulos };
}

const DIAGNOSTICO_CERO: Diagnostico = { barras: 0, sinNegociacionConCierreDistinto: 0, habilesConVolumenNull: 0 };

export class ErrorDepuracion extends Error {
  constructor(readonly codigo: "BASE_NO_COINCIDE") {
    super(codigo);
    this.name = "ErrorDepuracion";
  }
}

export interface OpcionesDepuracion {
  readonly desde: Date;
  readonly hasta: Date;
  readonly buscar: Buscar;
  readonly aplicar: boolean;
  readonly base: string | undefined;
  /** Solo para acotar (pruebas): por defecto, todas las especies con cierres vigentes de Yahoo en el rango. */
  readonly instrumentoIds?: readonly string[];
  readonly ahora?: Date;
}

export interface ResultadoDepuracion {
  readonly base: string;
  readonly aplicado: boolean;
  readonly especies: number;
  readonly vigentesRevisados: number;
  readonly aRetirarNoHabil: number;
  readonly aRetirarSinNegociacion: number;
  /** Retirados en esta corrida (0 en el ensayo). */
  readonly retirados: number;
  /** Al aplicar, ya no estaban vigentes (otra corrida los cambió): no se pisaron. */
  readonly cambiadosPorOtro: number;
  readonly sinCalendario: number;
  readonly aunNoDefinitivos: number;
  readonly diagnostico: Diagnostico;
  readonly fallidas: readonly { readonly instrumentoId: string; readonly codigo: string }[];
}

interface Especie {
  readonly id: string;
  readonly nemotecnico: string | null;
  readonly vigentes: readonly VigenteYahoo[];
}

/** Especies con cierres vigentes de Yahoo en el rango, con sus vigentes. */
async function leerEspecies(db: PrismaClient, o: OpcionesDepuracion): Promise<Especie[]> {
  const filas = await db.precioCierre.findMany({
    where: { fuente: FUENTE, reemplazadoEn: null, fecha: { gte: o.desde, lte: o.hasta }, ...(o.instrumentoIds ? { instrumentoId: { in: [...o.instrumentoIds] } } : {}) },
    select: { id: true, instrumentoId: true, fecha: true },
    orderBy: [{ instrumentoId: "asc" }, { fecha: "asc" }],
  });
  const porEspecie = new Map<string, VigenteYahoo[]>();
  for (const f of filas) porEspecie.set(f.instrumentoId, [...(porEspecie.get(f.instrumentoId) ?? []), { id: f.id, fecha: f.fecha }]);
  const instrumentos = await db.instrumento.findMany({ where: { id: { in: [...porEspecie.keys()] } }, select: { id: true, nemotecnico: true } });
  return instrumentos.map((i) => ({ ...i, vigentes: porEspecie.get(i.id) ?? [] }));
}

/** Retira por id solo si sigue vigente. Devuelve cuántos se retiraron (los demás los cambió otra corrida). */
async function retirarPorId(db: PrismaClient, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { count } = await db.precioCierre.updateMany({ where: { id: { in: [...ids] }, fuente: FUENTE, reemplazadoEn: null }, data: { reemplazadoEn: new Date() } });
  return count;
}

interface PasoEspecie {
  readonly instrumentoId: string;
  readonly clasificacion: ClasificacionEspecie;
  readonly diagnostico: Diagnostico;
  readonly retirados: number;
  readonly fallo: string | null;
}

async function depurarEspecie(db: PrismaClient, e: Especie, o: OpcionesDepuracion, ahora: Date, calendario: CalendarioBvc): Promise<PasoEspecie> {
  const nemotecnico = e.nemotecnico ?? "";
  const r = nemotecnico ? await obtenerCierres(await simboloDe(db, e.id, nemotecnico, o.hasta), o.desde, o.hasta, o.buscar) : { ok: false as const, codigo: "SIN_NEMOTECNICO" };
  const barras = r.ok ? r.cierres : null;
  const clasificacion = clasificarVigentes(e.vigentes, barras, ahora, calendario);
  const retirados = o.aplicar ? await retirarPorId(db, [...clasificacion.noHabil, ...clasificacion.sinNegociacion]) : 0;
  return { instrumentoId: e.id, clasificacion, diagnostico: barras ? diagnosticar(barras, ahora, calendario) : DIAGNOSTICO_CERO, retirados, fallo: r.ok ? null : r.codigo };
}

const sumarDiagnostico = (a: Diagnostico, b: Diagnostico): Diagnostico => ({
  barras: a.barras + b.barras,
  sinNegociacionConCierreDistinto: a.sinNegociacionConCierreDistinto + b.sinNegociacionConCierreDistinto,
  habilesConVolumenNull: a.habilesConVolumenNull + b.habilesConVolumenNull,
});

export async function depurarPrecios(db: PrismaClient, o: OpcionesDepuracion): Promise<ResultadoDepuracion> {
  const base = (await db.$queryRaw<{ base: string }[]>`SELECT current_database() AS base`)[0]?.base ?? "";
  if (o.aplicar && o.base !== base) throw new ErrorDepuracion("BASE_NO_COINCIDE");
  const ahora = o.ahora ?? new Date();
  const calendario = await leerCalendarioBvc(db, o.desde, o.hasta);
  const especies = await leerEspecies(db, o);
  const pasos: PasoEspecie[] = [];
  for (const e of especies) pasos.push(await depurarEspecie(db, e, o, ahora, calendario));
  const suma = (f: (p: PasoEspecie) => number) => pasos.reduce((t, p) => t + f(p), 0);
  const aRetirar = suma((p) => p.clasificacion.noHabil.length + p.clasificacion.sinNegociacion.length);
  return {
    base, aplicado: o.aplicar, especies: especies.length, vigentesRevisados: especies.reduce((t, e) => t + e.vigentes.length, 0),
    aRetirarNoHabil: suma((p) => p.clasificacion.noHabil.length), aRetirarSinNegociacion: suma((p) => p.clasificacion.sinNegociacion.length),
    retirados: suma((p) => p.retirados), cambiadosPorOtro: o.aplicar ? aRetirar - suma((p) => p.retirados) : 0,
    sinCalendario: suma((p) => p.clasificacion.sinCalendario), aunNoDefinitivos: suma((p) => p.clasificacion.aunNoDefinitivos),
    diagnostico: pasos.reduce((t, p) => sumarDiagnostico(t, p.diagnostico), DIAGNOSTICO_CERO),
    fallidas: pasos.flatMap((p) => (p.fallo ? [{ instrumentoId: p.instrumentoId, codigo: p.fallo }] : [])),
  };
}
