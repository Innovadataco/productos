/**
 * De la lectura (Decimal, Date) a la vista de la pantalla (texto). Cálculo puro.
 * - Una fila por especie (CANTIDAD y VALOR juntos), por nemotécnico: toma el peor estado de los dos y junta sus porqués.
 * - Filas aparte para el total de acciones, cada fondo y el efectivo.
 * - % de diferencia = (A&V − sistema) / |A&V| × 100, el mismo denominador de la tolerancia, en Decimal y con 2 decimales.
 * - El `detalle` se lee con guardas por clave y tipo: si no tiene la forma esperada, no se pinta. En el efectivo (v3),
 *   cuántos rendimientos del fondo contó la caja y el último día, para que se vea si falta alguno.
 */
import { Prisma, type ResultadoConciliacion } from "@prisma/client";
import { componer } from "@/app/_comun/fecha-dato/componer";
import { horaColombia } from "@/app/_comun/fecha-dato/hora";
import type { Procedencia } from "@/app/_comun/fecha-dato/tipos";
import type { ConciliacionLeida, ControlLeido, CorteDisponible, LecturaConciliacion, PorLiquidar } from "@/conciliacion/leer";
import { idsCalculados, SIN_PROCEDENCIAS, type LecturaProcedencias, type Origen } from "./calculados";
import { estadoDeControl, fraseDeMotivo, textoDeResultadoGlobal, type Estado, type Tono } from "./motivos";
import type { LineaConciliacionVista } from "../tablero/tipos";
import type { ConciliacionVista, CorteVista, CuentasVista, FilaEspecieVista, FilaMontoVista, PorLiquidarVista, ProcedenciasVista, VistaCorte } from "./tipos";

const DECIMALES_PCT = 2;
const DECIMAL = /^-?\d{1,30}(\.\d{1,12})?$/;
const GRAVEDAD: Readonly<Record<Tono, number>> = { cuadra: 0, "por-liquidar": 1, "sin-verificar": 2, "no-cuadra": 3 };
const TONO_GLOBAL: Readonly<Record<ResultadoConciliacion, Tono>> = { CUADRA: "cuadra", PARCIAL: "por-liquidar", NO_CUADRA: "no-cuadra" };
const OPERACION: Readonly<Record<PorLiquidar["operacion"], PorLiquidarVista["operacion"]>> = { COMPRA: "Compra", VENTA: "Venta", ESCISION: "Escisión" };

/** Columnas DATE: el día UTC es el día del dato. */
export const dia = (d: Date): string => d.toISOString().slice(0, 10);
const texto = (d: Prisma.Decimal | null): string | null => (d === null ? null : d.toString());

function porcentaje(diferencia: Prisma.Decimal | null, real: Prisma.Decimal | null): string | null {
  if (diferencia === null || real === null || real.isZero()) return null;
  return diferencia.div(real.abs()).mul(100).toFixed(DECIMALES_PCT);
}

const estado = (c: ControlLeido): Estado => estadoDeControl(c.resultado, c.codigoMotivo);
const peor = (estados: readonly Estado[]): Estado => estados.reduce((a, b) => (GRAVEDAD[b.tono] > GRAVEDAD[a.tono] ? b : a));
const porques = (controles: readonly (ControlLeido | undefined)[]): string[] =>
  [...new Set(controles.flatMap((c) => (c === undefined ? [] : [fraseDeMotivo(c.codigoMotivo)].filter((f): f is string => f !== null))))];

const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const alcance = (c: ControlLeido): unknown => (esObjeto(c.detalle) ? c.detalle.alcance : undefined);

function precios(valor: ControlLeido | undefined): FilaEspecieVista["precios"] {
  if (valor?.codigoMotivo !== "precio_distinto" && valor?.codigoMotivo !== "diferencia_valor") return null;
  const d = valor.detalle;
  if (!esObjeto(d) || typeof d.cierre !== "string" || typeof d.precioValoracion !== "string") return null;
  if (!DECIMAL.test(d.cierre) || !DECIMAL.test(d.precioValoracion)) return null;
  return { cierre: d.cierre, precioAv: d.precioValoracion };
}

function filaEspecie(id: string, cantidad: ControlLeido | undefined, valor: ControlLeido | undefined): FilaEspecieVista {
  const uno = (cantidad ?? valor)!;
  return {
    id, nemo: uno.instrumento?.nemotecnico ?? uno.instrumento?.nombre ?? "",
    cantidadAv: texto(cantidad?.real ?? null), cantidadSistema: texto(cantidad?.esperado ?? null), diferenciaCantidad: texto(cantidad?.diferencia ?? null),
    valorAv: texto(valor?.real ?? null), valorSistema: texto(valor?.esperado ?? null), diferenciaPct: porcentaje(valor?.diferencia ?? null, valor?.real ?? null),
    precios: precios(valor),
    estado: peor([cantidad, valor].filter((c): c is ControlLeido => c !== undefined).map(estado)),
    porque: porques([cantidad, valor]),
  };
}

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** En el efectivo (v3): los rendimientos del fondo que contó la caja, si el detalle los trae con su forma. */
function rendimientosContados(c: ControlLeido): string[] {
  const d = c.detalle;
  if (c.tipo !== "EFECTIVO" || !esObjeto(d)) return [];
  const { rendimientosFic: n, ultimoRendimientoFic: ultimo } = d;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || typeof ultimo !== "string" || !DIA_ISO.test(ultimo)) return [];
  return [`Rendimientos del fondo contados en la caja: ${n}; el último, del ${ultimo}.`];
}

function filaMonto(c: ControlLeido, etiqueta: string): FilaMontoVista {
  return {
    id: c.instrumentoId ?? c.tipo, etiqueta, av: texto(c.real), sistema: texto(c.esperado), diferencia: texto(c.diferencia),
    diferenciaPct: porcentaje(c.diferencia, c.real), estado: estado(c), porque: [...porques([c]), ...rendimientosContados(c)],
  };
}

function especies(controles: readonly ControlLeido[]): FilaEspecieVista[] {
  const porEspecie = new Map<string, { cantidad?: ControlLeido; valor?: ControlLeido }>();
  for (const c of controles) {
    if (c.instrumentoId === null || (c.tipo !== "CANTIDAD" && c.tipo !== "VALOR")) continue;
    const par = porEspecie.get(c.instrumentoId) ?? {};
    porEspecie.set(c.instrumentoId, c.tipo === "CANTIDAD" ? { ...par, cantidad: c } : { ...par, valor: c });
  }
  return [...porEspecie]
    .map(([id, par]) => filaEspecie(id, par.cantidad, par.valor))
    .sort((a, b) => (a.nemo < b.nemo ? -1 : a.nemo > b.nemo ? 1 : 0));
}

function cuentas(controles: readonly ControlLeido[]): CuentasVista {
  const tonos = controles.map((c) => estado(c).tono);
  const cuantos = (t: Tono) => tonos.filter((x) => x === t).length;
  return { cuadra: cuantos("cuadra"), noCuadra: cuantos("no-cuadra"), porLiquidar: cuantos("por-liquidar"), sinVerificar: cuantos("sin-verificar") };
}

const reconocido = (c: ControlLeido): boolean =>
  c.tipo === "EFECTIVO" || c.tipo === "FONDO" || c.tipo === "CANTIDAD" || (c.tipo === "VALOR" && (c.instrumentoId !== null || alcance(c) === "total_acciones"));

/**
 * Solo de lo que se calculó (frente fecha-hora-datos): una procedencia de una especie o un fondo sin cifra del sistema
 * no se muestra. El total, por el cierre más viejo de sus especies, solo si el total se calculó.
 */
function procedencias(k: ConciliacionLeida, corte: Date, leidas: LecturaProcedencias, totalCalculado: boolean): ProcedenciasVista {
  const de = (o: Origen): Procedencia => ({ dia: dia(corte), traidoEn: horaColombia(o.traidoEn), fuente: o.fuente });
  const porId = (ids: readonly string[], mapa: ReadonlyMap<string, Origen>) =>
    Object.fromEntries(ids.flatMap((id) => { const o = mapa.get(id); return o ? [[id, de(o)] as const] : []; }));
  const { especies: idsEspecies, fondos: idsFondos } = idsCalculados(k);
  const especies = porId(idsEspecies, leidas.cierres);
  return { especies, fondos: porId(idsFondos, leidas.fondos), total: totalCalculado ? componer(Object.values(especies)) : null };
}

function conciliacion(l: LecturaConciliacion, leidas: LecturaProcedencias): ConciliacionVista | null {
  const k = l.conciliacion;
  if (k === null || l.frescura === null) return null;
  const controles = k.controles.filter(reconocido);
  const total = controles.find((c) => c.tipo === "VALOR" && c.instrumentoId === null);
  const efectivo = controles.find((c) => c.tipo === "EFECTIVO");
  return {
    resultado: { texto: textoDeResultadoGlobal(k.resultado), tono: TONO_GLOBAL[k.resultado] },
    calculadaEn: horaColombia(k.calculadaEn),
    frescura: l.frescura,
    especies: especies(controles),
    total: total ? filaMonto(total, "Total de acciones") : null,
    fondos: controles.filter((c) => c.tipo === "FONDO").map((c) => filaMonto(c, c.instrumento?.nombre ?? "Fondo")),
    efectivo: efectivo ? filaMonto(efectivo, "Efectivo") : null,
    cuentas: cuentas(controles),
    noReconocidos: k.controles.length - controles.length,
    procedencias: procedencias(k, l.fechaCorte, leidas, total !== undefined && total.esperado !== null),
  };
}

/** `leidas`: de dónde y de cuándo es cada valor del sistema (src/app/conciliacion/procedencias.ts); sin ellas, ninguna. */
export function aVistaCorte(l: LecturaConciliacion, leidas: LecturaProcedencias = SIN_PROCEDENCIAS): VistaCorte {
  return {
    fechaCorte: dia(l.fechaCorte),
    conciliacion: conciliacion(l, leidas),
    porLiquidar: l.porLiquidar.map((p) => ({
      nemo: p.nemotecnico, operacion: OPERACION[p.operacion], cantidad: p.cantidad.toString(), fechaOperacion: dia(p.fechaOperacion), fechaLiquidacion: dia(p.fechaLiquidacion),
    })),
  };
}

export function aCortes(cortes: readonly CorteDisponible[], actual: string | null): CorteVista[] {
  return cortes.map((c) => ({ fecha: dia(c.fechaCorte), texto: c.resultado === null ? "Sin conciliar" : textoDeResultadoGlobal(c.resultado), actual: dia(c.fechaCorte) === actual }));
}

/** La línea del tablero: el corte más reciente y el resultado guardado de su última conciliación. */
export const aLineaDelTablero = (c: CorteDisponible | null): LineaConciliacionVista => (c === null ? null : { fechaCorte: dia(c.fechaCorte), resultado: c.resultado });
