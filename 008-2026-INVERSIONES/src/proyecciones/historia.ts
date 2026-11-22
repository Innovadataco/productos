/**
 * Arma la historia de retornos diarios del portafolio de hoy (método en metodo.ts). Puro.
 * - Días: solo hábiles de la BVC (ni fin de semana ni festivo de calendario_bvc) y hasta hoy. La rejilla son los días
 *   en que al menos una ACCIÓN proyectada tiene cierre (si no hay acciones, los del fondo): así un año sin festivos
 *   sembrados no mete días sin rueda.
 * - Elegible: al menos MINIMO_DIAS días con cierre propio (el fondo: con valor de unidad en día hábil). Ventana común:
 *   desde el primer día más tardío entre las elegibles (la historia más corta manda) hasta el último de la rejilla;
 *   una elegible con menos de MINIMO_DIAS días dentro de la ventana queda fija. Sin cascada: las que quedan fijas no
 *   vuelven a entrar.
 * - Un día sin dato propio arrastra el último precio (factor 1) y el siguiente dato lleva todo el movimiento; el fondo
 *   toma su último valor de unidad, así que el fin de semana se acumula en el lunes.
 * - Valor de hoy: cantidad × último cierre (unidades × último valor de unidad). Sin ningún dato: no se puede valorar
 *   y queda fuera, con aviso. Con historia corta: queda fija en su valor de hoy, con aviso.
 */
import { diaIso, esDiaHabil } from "../precios/horario";
import { ajustesPorEscision, ajustesPorSalto, primerIndiceDesde, type ContextoAjuste, type Correccion } from "./ajustes";
import { dividendosPorAccion } from "./dividendos";
import { desviacion, media } from "./estadistica";
import { DIAS_POR_MES, MINIMO_DIAS } from "./metodo";
import type { AvisoCrudo, Dia, EntradasProyeccion, EstadoPosicion, Historia, PosicionEntrada, PosicionSupuesta, Ventana } from "./tipos";

const DIA_MS = 86_400_000;

export interface Columna {
  readonly instrumentoId: string;
  readonly nombre: string;
  readonly valorHoy: number;
}

export interface ArmadoHistoria {
  readonly historia: Historia;
  readonly columnas: readonly Columna[];
  /** Suma del valor de hoy de las posiciones fijas. */
  readonly valorFijo: number;
  /** Suma del valor de hoy de todo lo que se pudo valorar. */
  readonly valorHoy: number;
  readonly posiciones: readonly PosicionSupuesta[];
  readonly avisos: readonly AvisoCrudo[];
  readonly ventana: Ventana | null;
  readonly decretosFuturos: number;
  readonly rendimientoAnualVentana: number | null;
  readonly volatilidadAnualVentana: number | null;
}

interface Punto {
  readonly dia: Dia;
  readonly valor: number;
}

interface Preparada {
  readonly entrada: PosicionEntrada;
  /** Días hábiles con dato propio hasta hoy, ordenados y sin repetir. */
  readonly propios: readonly Dia[];
  /** De dónde se arrastra el precio: las acciones, sus cierres hábiles; el fondo, todos sus valores hasta hoy. */
  readonly serie: readonly Punto[];
  readonly valorHoy: number | null;
}

/** Puntos hasta hoy, por día (el último de un día repetido gana), ordenados. */
function ordenar(puntos: readonly Punto[]): Punto[] {
  const porDia = new Map(puntos.map((p) => [p.dia, p]));
  return [...porDia.values()].sort((a, b) => (a.dia < b.dia ? -1 : 1));
}

function preparar(p: PosicionEntrada, hoy: Dia, noHabiles: ReadonlySet<string>): Preparada {
  const habil = (d: Dia) => esDiaHabil(new Date(`${d}T00:00:00Z`), noHabiles);
  const crudos = p.tipo === "ACCION" ? p.cierres.map((c) => ({ dia: diaIso(c.dia), valor: c.precio })) : p.valores.map((v) => ({ dia: diaIso(v.dia), valor: v.valorUnidad }));
  const hastaHoy = ordenar(crudos.filter((x) => x.dia <= hoy));
  const serie = p.tipo === "ACCION" ? hastaHoy.filter((x) => habil(x.dia)) : hastaHoy;
  const ultimo = serie.at(-1);
  const cantidad = p.tipo === "ACCION" ? p.cantidad : p.unidades;
  return { entrada: p, propios: serie.map((x) => x.dia).filter(habil), serie, valorHoy: ultimo ? cantidad * ultimo.valor : null };
}

const contarEntre = (propios: readonly Dia[], desde: Dia, hasta: Dia): number => primerIndiceDesde(propios, hasta + "\u0000") - primerIndiceDesde(propios, desde);
const primero = (p: Preparada): Dia => p.propios[0]!;
const masTardio = (ps: readonly Preparada[]): Preparada => ps.reduce((a, b) => (primero(b) > primero(a) ? b : a));

function rejilla(acciones: readonly Preparada[], fondos: readonly Preparada[], desde: Dia): Dia[] {
  const fuente = acciones.length > 0 ? acciones : fondos;
  return [...new Set(fuente.flatMap((p) => p.propios.filter((d) => d >= desde)))].sort();
}

interface Seleccion {
  readonly proyectadas: readonly Preparada[];
  readonly dias: readonly Dia[];
  readonly limitadaPor: string;
}

function seleccionar(preparadas: readonly Preparada[]): Seleccion | null {
  const elegibles = preparadas.filter((p) => p.valorHoy !== null && p.propios.length >= MINIMO_DIAS);
  if (elegibles.length === 0) return null;
  const inicio = primero(masTardio(elegibles));
  const ultimoDia = "9999-12-31";
  const alcanza = (p: Preparada, hasta: Dia) => contarEntre(p.propios, inicio, hasta) >= MINIMO_DIAS;
  const acciones = elegibles.filter((p) => p.entrada.tipo === "ACCION" && alcanza(p, ultimoDia));
  const candidatosFondo = elegibles.filter((p) => p.entrada.tipo === "FONDO" && alcanza(p, ultimoDia));
  const fin = rejilla(acciones, candidatosFondo, inicio).at(-1) ?? inicio;
  const fondos = candidatosFondo.filter((p) => alcanza(p, fin));
  const proyectadas = preparadas.filter((p) => acciones.includes(p) || fondos.includes(p));
  if (proyectadas.length === 0) return null;
  const limita = masTardio(proyectadas);
  return { proyectadas, dias: rejilla(acciones, fondos, primero(limita)), limitadaPor: limita.entrada.nombre };
}

/** D × K precios con el último valor arrastrado. */
function arrastrar(dias: readonly Dia[], proyectadas: readonly Preparada[]): Float64Array {
  const K = proyectadas.length;
  const precios = new Float64Array(dias.length * K);
  proyectadas.forEach((p, k) => {
    let i = 0;
    let ultimo = Number.NaN;
    dias.forEach((d, j) => {
      for (; i < p.serie.length && p.serie[i]!.dia <= d; i += 1) ultimo = p.serie[i]!.valor;
      precios[j * K + k] = ultimo;
    });
  });
  return precios;
}

const aplicar = (base: Float64Array, K: number, correcciones: readonly Correccion[]): Float64Array => {
  const nuevo = Float64Array.from(base);
  for (const c of correcciones) nuevo[c.t * K + c.k] = c.factor;
  return nuevo;
};

interface Matriz {
  readonly factores: Float64Array;
  readonly rendimientos: Float64Array;
  readonly avisos: readonly AvisoCrudo[];
  readonly usados: ReadonlyMap<string, { readonly n: number; readonly primero: Dia | null }>;
  readonly decretosFuturos: number;
}

function cierresPorId(e: EntradasProyeccion, preparadas: readonly Preparada[]): Map<string, ReadonlyMap<Dia, number>> {
  const destinos = Object.entries(e.cierresDestino).map(([id, cs]) => [id, new Map(cs.map((c) => [diaIso(c.dia), c.precio]))] as const);
  const propias = preparadas.filter((p) => p.entrada.tipo === "ACCION").map((p) => [p.entrada.instrumentoId, new Map(p.serie.map((x) => [x.dia, x.valor]))] as const);
  return new Map([...destinos, ...propias]);
}

function matriz(e: EntradasProyeccion, preparadas: readonly Preparada[], s: Seleccion, hoy: Date): Matriz {
  const { dias, proyectadas } = s;
  const K = proyectadas.length;
  const T = dias.length - 1;
  const precios = arrastrar(dias, proyectadas);
  const crudos = new Float64Array(T * K);
  for (let t = 0; t < T; t += 1) for (let k = 0; k < K; k += 1) crudos[t * K + k] = precios[(t + 1) * K + k]! / precios[t * K + k]!;
  const ctx: ContextoAjuste = {
    dias, K, precios, cierres: cierresPorId(e, preparadas),
    columnas: proyectadas.map((p) => ({ instrumentoId: p.entrada.instrumentoId, nombre: p.entrada.nombre, diasPropios: p.propios })),
  };
  const escision = ajustesPorEscision(ctx, e.escisiones);
  const conEscision = aplicar(crudos, K, escision.correcciones);
  const salto = ajustesPorSalto(ctx, conEscision, new Set(escision.correcciones.map((c) => c.t * K + c.k)));
  const rendimientos = new Float64Array(T * K);
  const usados = new Map<string, { n: number; primero: Dia | null }>();
  const avisosDiv: AvisoCrudo[] = [];
  let decretosFuturos = 0;
  proyectadas.forEach((p, k) => {
    if (p.entrada.tipo !== "ACCION") return;
    const d = dividendosPorAccion(p.entrada, hoy);
    decretosFuturos += d.decretosFuturos;
    // Con el precio del día anterior en 0 o inválido no hay rendimiento que calcular: el pago no se usa.
    const previo = (dia: Dia) => precios[(primerIndiceDesde(dias, dia) - 1) * K + k]!;
    const dentro = d.pagos.filter((x) => x.dia > dias[0]! && x.dia <= dias[T]! && previo(x.dia) > 0 && Number.isFinite(previo(x.dia)));
    // El bruto de un decreto que no entra a la ventana no se suma: tampoco se avisa que entra.
    const brutosDentro = new Set(dentro.filter((x) => x.origen === "DECRETO").map((x) => x.dia));
    avisosDiv.push(...d.avisos.filter((x) => x.codigo !== "DECRETO_BRUTO" || (x.dia !== null && brutosDentro.has(x.dia))));
    dentro.forEach((x) => {
      const j = primerIndiceDesde(dias, x.dia);
      rendimientos[(j - 1) * K + k] = rendimientos[(j - 1) * K + k]! + x.porAccion / previo(x.dia);
    });
    usados.set(p.entrada.instrumentoId, { n: dentro.length, primero: dentro[0] ? dias[primerIndiceDesde(dias, dentro[0].dia)]! : null });
  });
  return { factores: aplicar(conEscision, K, salto.correcciones), rendimientos, avisos: [...escision.avisos, ...salto.avisos, ...avisosDiv], usados, decretosFuturos };
}

/** Rendimiento y volatilidad anuales del portafolio de hoy (pesos de hoy, cada día) en la ventana: dato histórico. */
function historicoAnual(h: Historia, valores: readonly number[]): { rendimiento: number | null; volatilidad: number | null } {
  const total = valores.reduce((s, v) => s + v, 0);
  if (h.K === 0 || h.T < 2 || total <= 0) return { rendimiento: null, volatilidad: null };
  const logs = Array.from({ length: h.T }, (_, t) =>
    Math.log(valores.reduce((s, v, k) => s + (v / total) * (h.factores[t * h.K + k]! + h.rendimientos[t * h.K + k]!), 0)),
  );
  const ruedasAnio = 12 * h.ruedasPorMes;
  return { rendimiento: Math.exp(media(logs) * ruedasAnio) - 1, volatilidad: desviacion(logs) * Math.sqrt(ruedasAnio) };
}

interface Contexto {
  readonly estados: ReadonlyMap<Preparada, EstadoPosicion>;
  readonly anios: ReadonlySet<number>;
  readonly dias: readonly Dia[];
}

const enVentana = (p: Preparada, dias: readonly Dia[]): number => (dias.length > 0 ? contarEntre(p.propios, dias[0]!, dias.at(-1)!) : 0);

/** Fija con pocos días en total, o con 250 o más en total pero pocos en la ventana común (el aviso dice cuál). */
function avisoFija(p: Preparada, dias: readonly Dia[]): AvisoCrudo {
  const largo = p.propios.length >= MINIMO_DIAS;
  return {
    codigo: largo ? "HISTORIA_CORTA_EN_VENTANA" : "HISTORIA_CORTA", instrumentoId: p.entrada.instrumentoId, nombre: p.entrada.nombre, dia: null,
    dato: largo ? enVentana(p, dias) : p.propios.length,
  };
}

function avisosGenerales(e: EntradasProyeccion, preparadas: readonly Preparada[], { estados, anios, dias }: Contexto): AvisoCrudo[] {
  const deP = (p: Preparada, codigo: AvisoCrudo["codigo"]): AvisoCrudo => ({ codigo, instrumentoId: p.entrada.instrumentoId, nombre: p.entrada.nombre, dia: null, dato: p.propios.length });
  const sinCalendario = [...new Set(preparadas.flatMap((p) => p.propios.map((d) => Number(d.slice(0, 4)))))].filter((a) => !anios.has(a)).sort();
  return [
    ...e.incompletas.map((nombre): AvisoCrudo => ({ codigo: "ESPECIE_INCOMPLETA", instrumentoId: null, nombre, dia: null, dato: null })),
    ...preparadas.filter((p) => estados.get(p) === "EXCLUIDA_SIN_VALOR").map((p) => deP(p, "SIN_VALOR")),
    ...preparadas.filter((p) => estados.get(p) === "FIJA_HISTORIA_CORTA").map((p) => avisoFija(p, dias)),
    ...sinCalendario.map((anio): AvisoCrudo => ({ codigo: "ANIO_SIN_CALENDARIO", instrumentoId: null, nombre: null, dia: null, dato: anio })),
  ];
}

const sinRiesgo = (valorHoy: number, K: number): AvisoCrudo[] => {
  if (valorHoy <= 0) return [{ codigo: "SIN_POSICIONES_VALORADAS", instrumentoId: null, nombre: null, dia: null, dato: null }];
  return K === 0 ? [{ codigo: "SIN_POSICIONES_PROYECTADAS", instrumentoId: null, nombre: null, dia: null, dato: null }] : [];
};

export function armarHistoria(e: EntradasProyeccion): ArmadoHistoria {
  const noHabiles = new Set(e.noHabiles.map(diaIso));
  const anios = new Set(e.noHabiles.map((d) => d.getUTCFullYear()));
  const hoy = diaIso(e.hoy);
  const preparadas = e.posiciones.map((p) => preparar(p, hoy, noHabiles));
  const s = seleccionar(preparadas);
  const estados = new Map(preparadas.map((p): [Preparada, EstadoPosicion] => [p, p.valorHoy === null ? "EXCLUIDA_SIN_VALOR" : s?.proyectadas.includes(p) ? "PROYECTADA" : "FIJA_HISTORIA_CORTA"]));
  const m = s ? matriz(e, preparadas, s, e.hoy) : null;
  const dias = s?.dias ?? [];
  const meses = dias.length > 1 ? (Date.parse(dias.at(-1)!) - Date.parse(dias[0]!)) / DIA_MS / DIAS_POR_MES : 0;
  const K = s?.proyectadas.length ?? 0;
  const historia: Historia = {
    dias, T: Math.max(dias.length - 1, 0), K, factores: m?.factores ?? new Float64Array(0), rendimientos: m?.rendimientos ?? new Float64Array(0),
    ruedasPorMes: meses > 0 ? (dias.length - 1) / meses : 0,
  };
  const valorHoy = preparadas.reduce((t, p) => t + (p.valorHoy ?? 0), 0);
  const posiciones = preparadas.map((p): PosicionSupuesta => {
    const usado = m?.usados.get(p.entrada.instrumentoId);
    return {
      instrumentoId: p.entrada.instrumentoId, nombre: p.entrada.nombre, tipo: p.entrada.tipo === "ACCION" ? "ACCION" : "FONDO", estado: estados.get(p)!,
      valorHoy: p.valorHoy, peso: p.valorHoy === null ? null : valorHoy > 0 ? p.valorHoy / valorHoy : 0,
      diasEnVentana: enVentana(p, dias), diasTotales: p.propios.length,
      ultimoDia: p.propios.at(-1) ?? null, dividendosUsados: usado?.n ?? 0, primerDividendo: usado?.primero ?? null,
    };
  });
  const columnas = (s?.proyectadas ?? []).map((p): Columna => ({ instrumentoId: p.entrada.instrumentoId, nombre: p.entrada.nombre, valorHoy: p.valorHoy! }));
  const anual = historicoAnual(historia, columnas.map((c) => c.valorHoy));
  return {
    historia, columnas, valorHoy, posiciones,
    valorFijo: preparadas.filter((p) => estados.get(p) === "FIJA_HISTORIA_CORTA").reduce((t, p) => t + p.valorHoy!, 0),
    avisos: [...avisosGenerales(e, preparadas, { estados, anios, dias }), ...(m?.avisos ?? []), ...sinRiesgo(valorHoy, K)],
    ventana: s ? { desde: dias[0]!, hasta: dias.at(-1)!, ruedas: dias.length, limitadaPor: s.limitadaPor } : null,
    decretosFuturos: m?.decretosFuturos ?? 0, rendimientoAnualVentana: anual.rendimiento, volatilidadAnualVentana: anual.volatilidad,
  };
}

