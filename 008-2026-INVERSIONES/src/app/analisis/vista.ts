/**
 * La vista de /analisis (frente analisis-pantalla, A2): el análisis del motor (src/analisis/) en texto, ya formateado,
 * sin recalcular nada. Puro. Lo que el motor no calculó se dice en palabras: nunca un 0 inventado. Los ids opacos no
 * salen en pantalla: se cruzan con los nombres del tablero (y del fondo); los de reglas y decisiones no se muestran.
 */
import type { Observacion } from "@/analisis/catalogo";
import type {
  Analisis, AnalisisEspecie, Concentracion, PortafolioConFondo, ResumenDecisiones, ResumenHorizonte, RiesgoPortafolio, VentanaRendimiento,
} from "@/analisis/tipos";
import { textoAviso } from "@/proyecciones/supuestos";
import { componer } from "../_comun/fecha-dato/componer";
import type { Procedencia, ProcedenciaCompuesta } from "../_comun/fecha-dato/tipos";
import { cop, fecha, numero } from "../tablero/formato";
import {
  conSigno, DIARIO_PARCIAL, NOTA_FONDO, porcentaje, SIN_CAIDA, SIN_CIERRE, SIN_DECISIONES, SIN_HISTORIA, SIN_HISTORIA_SUFICIENTE, SIN_RIESGO,
  SIN_CAIDA_HISTORICA, SIN_VALOR, SIN_VARIACION, SIN_VEREDICTO_TODAVIA, textoObservacion, textoUmbral, TITULO_VOLATILIDAD,
} from "./textos";

const UNA_ESPECIE = "una especie";

export interface EntradaVista {
  readonly analisis: Analisis;
  readonly observaciones: readonly Observacion[];
  /** instrumentoId → nemotécnico (o el nombre del fondo). */
  readonly nombres: ReadonlyMap<string, string>;
  readonly procedencias: { readonly acciones: readonly Procedencia[]; readonly fondos: ReadonlyMap<string, Procedencia> };
  /** El diario se leyó con su tope (TOPE_DIARIO): la cuenta de decisiones es parcial. */
  readonly diarioTruncado: boolean;
  /** Fondos vivos sin valor de unidad hasta hoy (`fondosDeHistoria`). */
  readonly fondosSinValor: readonly string[];
}

export interface FilaEspecieVista {
  /** instrumentoId: la clave estable de la fila (el nombre puede repetirse). */
  readonly id: string;
  readonly nombre: string;
  readonly peso: string;
  /** 1, 3, 6 y 12 meses. */
  readonly ventanas: readonly [string, string, string, string];
  readonly volatilidad: string;
  readonly caida: string;
  readonly dividendo: string;
  readonly contribucion: string;
}

export interface FilaComposicionVista {
  /** «acciones» o el instrumentoId del fondo. */
  readonly id: string;
  readonly nombre: string;
  readonly valor: string;
  readonly peso: string | null;
  readonly procedencia: Procedencia | null;
}

export interface MatrizVista {
  readonly ids: readonly string[];
  readonly nombres: readonly string[];
  readonly filas: readonly { readonly id: string; readonly nombre: string; readonly celdas: readonly string[] }[];
}

interface EfectoVista {
  readonly id: string;
  readonly nombre: string;
  readonly pesos: string;
  /** null: la especie no tuvo caída en su historia. */
  readonly fraccion: string | null;
}

export interface VistaAnalisis {
  readonly hoy: string;
  readonly version: string;
  readonly referencia: string;
  readonly cargaDetenida: string | null;
  readonly procedenciaAcciones: ProcedenciaCompuesta | null;
  readonly titulos: { readonly volatilidad: string };
  readonly composicion: {
    readonly filas: readonly FilaComposicionVista[];
    readonly total: string | null;
    readonly nota: string;
    readonly sinValor: string | null;
  };
  readonly especies: readonly FilaEspecieVista[];
  readonly portafolio: {
    readonly volatilidad: string;
    readonly ventana: string | null;
    readonly cubierta: string | null;
    readonly concentracion: readonly string[];
    readonly matriz: MatrizVista | null;
    readonly efectos: readonly EfectoVista[];
  };
  readonly decisiones: { readonly horizontes: readonly { readonly titulo: string; readonly lineas: readonly string[] }[]; readonly truncado: string | null };
  readonly puntos: readonly { readonly texto: string; readonly umbral: string }[];
  readonly avisos: readonly string[];
}

type Nombre = (id: string | null) => string;

const ventana = (v: VentanaRendimiento): string => (v.estado === "CALCULADA" ? conSigno(v.total) : SIN_HISTORIA);

function ventanas(e: AnalisisEspecie): FilaEspecieVista["ventanas"] {
  if (e.historia.estado !== "CON_HISTORIA") return [SIN_HISTORIA, SIN_HISTORIA, SIN_HISTORIA, SIN_HISTORIA];
  const [a, b, c, d] = e.historia.ventanas;
  return [ventana(a), ventana(b), ventana(c), ventana(d)];
}

function caida(e: AnalisisEspecie): string {
  if (e.historia.estado !== "CON_HISTORIA") return SIN_HISTORIA;
  return e.historia.caidaMaxima.estado === "CAIDA" ? porcentaje(e.historia.caidaMaxima.fraccion) : SIN_CAIDA;
}

function riesgoEspecie(e: AnalisisEspecie): { readonly volatilidad: string; readonly contribucion: string } {
  if (e.riesgo.estado === "SIN_VALOR") return { volatilidad: SIN_CIERRE, contribucion: SIN_CIERRE };
  if (e.riesgo.estado === "SIN_HISTORIA") return { volatilidad: SIN_HISTORIA_SUFICIENTE, contribucion: SIN_HISTORIA_SUFICIENTE };
  const contribucion = e.riesgo.contribucion === null ? SIN_RIESGO : porcentaje(e.riesgo.contribucion.contribucionPct);
  return { volatilidad: porcentaje(e.riesgo.volatilidadAnual), contribucion };
}

function dividendo(e: AnalisisEspecie): string {
  if (e.dividendo12m === null) return e.valor === null ? SIN_CIERRE : SIN_HISTORIA;
  const { fraccion, descartados } = e.dividendo12m;
  // Con pagos descartados el rendimiento queda por debajo (tipos.ts): se dice, no se pinta como un dato limpio.
  return descartados === 0 ? porcentaje(fraccion) : `${porcentaje(fraccion)} (${descartados === 1 ? "1 pago" : `${descartados} pagos`} sin tenencia clara)`;
}

function filaEspecie(e: AnalisisEspecie, nombre: Nombre): FilaEspecieVista {
  return { id: e.instrumentoId, dividendo: dividendo(e), nombre: nombre(e.instrumentoId), peso: e.peso === null ? SIN_CIERRE : porcentaje(e.peso), ventanas: ventanas(e), caida: caida(e), ...riesgoEspecie(e) };
}

function concentracion(c: Concentracion | null, nombre: Nombre): readonly string[] {
  if (c === null) return ["Sin especies con valor."];
  const tres = c.tresPrimeras.instrumentoIds.map(nombre).join(", ");
  return [
    `${c.especies === 1 ? "1 especie" : `${c.especies} especies`} con valor.`,
    `La de mayor valor, ${nombre(c.primera.instrumentoId)}, pesa ${porcentaje(c.primera.peso)}.`,
    `Las ${c.tresPrimeras.instrumentoIds.length === 1 ? "primera" : `${c.tresPrimeras.instrumentoIds.length} primeras`} (${tres}) pesan ${porcentaje(c.tresPrimeras.peso)}.`,
    `Índice de Herfindahl: ${numero(c.hhi, 2)} (equivale a ${numero(1 / c.hhi, 1)} especies de igual peso).`,
  ];
}

function matriz(r: RiesgoPortafolio, nombre: Nombre): MatrizVista | null {
  if (r.estado !== "CALCULADO") return null;
  const nombres = r.correlacion.ids.map(nombre);
  return {
    ids: r.correlacion.ids,
    nombres,
    filas: r.correlacion.valores.map((fila, i) => ({ id: r.correlacion.ids[i]!, nombre: nombres[i]!, celdas: fila.map((x) => (x === null ? SIN_VARIACION : numero(x, 2))) })),
  };
}

function portafolio(a: Analisis, nombre: Nombre): VistaAnalisis["portafolio"] {
  const r = a.riesgo;
  const efectos = a.especies.flatMap((e): EfectoVista[] => {
    if (e.efectoCaida === null) return [];
    const base = { id: e.instrumentoId, nombre: nombre(e.instrumentoId) };
    // Sin caída en la historia el motor da 0: se dice en palabras.
    if (e.efectoCaida.pesos.isZero()) return [{ ...base, pesos: SIN_CAIDA_HISTORICA, fraccion: null }];
    return [{ ...base, pesos: cop(e.efectoCaida.pesos.toNumber(), true), fraccion: conSigno(e.efectoCaida.fraccionPortafolio) }];
  });
  const calculado = r.estado === "CALCULADO";
  return {
    volatilidad: calculado ? porcentaje(r.volatilidadAnual) : SIN_HISTORIA_SUFICIENTE,
    ventana: calculado ? `Ventana común: del ${fecha(r.ventana.desde)} al ${fecha(r.ventana.hasta)} (${r.ventana.ruedas} ruedas).` : null,
    cubierta: calculado ? `Cubre ${porcentaje(r.fraccionCubierta)} del valor de las acciones.` : null,
    concentracion: concentracion(a.concentracion, nombre),
    matriz: matriz(r, nombre),
    efectos,
  };
}

function horizonte(h: ResumenHorizonte): { readonly titulo: string; readonly lineas: readonly string[] } {
  const titulo = `A ${h.horizonteDias} días`;
  if (h.decisiones === 0) return { titulo, lineas: [SIN_DECISIONES] };
  const v = h.veredictos;
  const lineas = [
    `De ${h.decisiones}: ${v.FUNCIONO} funcionaron, ${v.NO_FUNCIONO} no funcionaron y ${v.NEUTRO} neutras.`,
    `Todavía sin resultado: ${h.pendientes} pendientes, ${h.sinPrecio} sin precio, ${h.sinOrden} sin orden y ${h.sinVeredicto} sin veredicto.`,
    // Sin ninguna con veredicto, el total del motor es 0 por construcción: se dice, no se pinta «$ 0».
    v.FUNCIONO + v.NO_FUNCIONO + v.NEUTRO === 0 ? SIN_VEREDICTO_TODAVIA : `Resultado en pesos de las que tienen veredicto: ${cop(h.totalPesos.toNumber(), true)}.`,
    ...(h.sinDividendosEnTotal > 0 ? [`${h.sinDividendosEnTotal} de ellas sin dividendos medidos (solo el precio).`] : []),
    ...(h.noVerificadasEnTotal > 0 ? [`${h.noVerificadasEnTotal} de ellas con algún cierre sin verificar.`] : []),
  ];
  return { titulo, lineas };
}

const decisiones = (d: ResumenDecisiones, truncado: boolean): VistaAnalisis["decisiones"] => ({ horizontes: [horizonte(d.d30), horizonte(d.d90)], truncado: truncado ? DIARIO_PARCIAL : null });

function composicion(a: Analisis, x: EntradaVista, nombre: Nombre): VistaAnalisis["composicion"] {
  const c: PortafolioConFondo | undefined = a.conFondo;
  // Sin la entrada del fondo no hay peso que mostrar (null); con ella, un peso que no se calcula se dice.
  const peso = (x: number | null): string => (x === null ? SIN_VALOR : porcentaje(x));
  const acciones: FilaComposicionVista = { id: "acciones", nombre: "Acciones", valor: cop(a.valorAcciones.toNumber()), peso: c === undefined ? null : peso(c.pesoAcciones), procedencia: null };
  const fondos = (c?.fondos ?? []).map((f): FilaComposicionVista => ({
    id: f.instrumentoId, nombre: nombre(f.instrumentoId), valor: cop(f.valor.toNumber()), peso: peso(f.peso), procedencia: x.procedencias.fondos.get(f.instrumentoId) ?? null,
  }));
  const sinValor = x.fondosSinValor.length === 0 ? null : `Sin un valor en pesos hasta hoy (no se suman): ${x.fondosSinValor.map(nombre).join(" · ")}.`;
  return { filas: [acciones, ...fondos], total: c === undefined ? null : cop(c.valorTotal.toNumber()), nota: NOTA_FONDO, sinValor };
}

export function aVistaAnalisis(x: EntradaVista): VistaAnalisis {
  const a = x.analisis;
  const nombre: Nombre = (id) => (id === null ? UNA_ESPECIE : (x.nombres.get(id) ?? UNA_ESPECIE));
  return {
    hoy: fecha(a.hoy),
    version: a.version,
    referencia: a.referencia === null ? "Todavía no hay cierres de sus especies." : `Cierres hasta el ${fecha(a.referencia.dia)}.`,
    cargaDetenida: a.referencia?.cargaDetenida ? `Los precios no se han actualizado desde el ${fecha(a.referencia.dia)}.` : null,
    procedenciaAcciones: componer(x.procedencias.acciones),
    titulos: { volatilidad: TITULO_VOLATILIDAD },
    composicion: composicion(a, x, nombre),
    especies: a.especies.map((e) => filaEspecie(e, nombre)),
    portafolio: portafolio(a, nombre),
    decisiones: decisiones(a.decisiones, x.diarioTruncado),
    puntos: x.observaciones.map((o) => ({ texto: textoObservacion(o, nombre), umbral: textoUmbral(o.clave) })),
    avisos: a.avisos.map((v) => textoAviso({ ...v, nombre: v.instrumentoId === null ? null : nombre(v.instrumentoId) })),
  };
}
