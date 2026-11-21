/**
 * De la lectura (Decimal, Date) a la vista de la pantalla (texto). Cálculo puro.
 * - Una fila por especie (CANTIDAD y VALOR juntos), por nemotécnico: toma el peor estado de los dos y junta sus porqués.
 * - Filas aparte para el total de acciones, cada fondo y el efectivo.
 * - % de diferencia = (A&V − sistema) / |A&V| × 100, el mismo denominador de la tolerancia, en Decimal y con 2 decimales.
 * - El `detalle` se lee con guardas por clave y tipo: si no tiene la forma esperada, no se pinta.
 */
import { Prisma, type ResultadoConciliacion } from "@prisma/client";
import type { ControlLeido, CorteDisponible, LecturaConciliacion, PorLiquidar } from "@/conciliacion/leer";
import { estadoDeControl, fraseDeMotivo, textoDeResultadoGlobal, type Estado, type Tono } from "./motivos";
import type { ConciliacionVista, CorteVista, CuentasVista, FilaEspecieVista, FilaMontoVista, PorLiquidarVista, VistaCorte } from "./tipos";

const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000;
const DECIMALES_PCT = 2;
const DECIMAL = /^-?\d{1,30}(\.\d{1,12})?$/;
const GRAVEDAD: Readonly<Record<Tono, number>> = { cuadra: 0, "por-liquidar": 1, "sin-verificar": 2, "no-cuadra": 3 };
const TONO_GLOBAL: Readonly<Record<ResultadoConciliacion, Tono>> = { CUADRA: "cuadra", PARCIAL: "por-liquidar", NO_CUADRA: "no-cuadra" };
const OPERACION: Readonly<Record<PorLiquidar["operacion"], PorLiquidarVista["operacion"]>> = { COMPRA: "Compra", VENTA: "Venta", ESCISION: "Escisión" };

const dia = (d: Date): string => d.toISOString().slice(0, 10);
const horaColombia = (d: Date): string => new Date(d.getTime() - DESFASE_COLOMBIA_MS).toISOString().slice(0, 16).replace("T", " ");
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

function filaMonto(c: ControlLeido, etiqueta: string): FilaMontoVista {
  return {
    id: c.instrumentoId ?? c.tipo, etiqueta, av: texto(c.real), sistema: texto(c.esperado), diferencia: texto(c.diferencia),
    diferenciaPct: porcentaje(c.diferencia, c.real), estado: estado(c), porque: porques([c]),
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

function conciliacion(l: LecturaConciliacion): ConciliacionVista | null {
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
  };
}

export function aVistaCorte(l: LecturaConciliacion): VistaCorte {
  return {
    fechaCorte: dia(l.fechaCorte),
    conciliacion: conciliacion(l),
    porLiquidar: l.porLiquidar.map((p) => ({
      nemo: p.nemotecnico, operacion: OPERACION[p.operacion], cantidad: p.cantidad.toString(), fechaOperacion: dia(p.fechaOperacion), fechaLiquidacion: dia(p.fechaLiquidacion),
    })),
  };
}

export function aCortes(cortes: readonly CorteDisponible[], actual: string | null): CorteVista[] {
  return cortes.map((c) => ({ fecha: dia(c.fechaCorte), texto: c.resultado === null ? "Sin conciliar" : textoDeResultadoGlobal(c.resultado), actual: dia(c.fechaCorte) === actual }));
}
