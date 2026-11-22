/**
 * Tipos del motor de proyecciones (hito 2 del PRD de visualización y proyecciones). Puro: sin base ni servidor.
 * Las entradas las arma `leer.ts` desde la base; el resultado es JSON puro (sin Date, BigInt, Map ni NaN) para que
 * la pantalla lo pinte tal cual. Nada de aquí recomienda comprar, vender ni mantener.
 */
import type { MovimientoTenencia } from "../plan/tenencia";

/** Día de negocio `AAAA-MM-DD`. */
export type Dia = string;

export const FRECUENCIAS = ["MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];
export const MESES_FRECUENCIA: Readonly<Record<Frecuencia, number>> = { MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };

/** Lo que mueve el usuario en el simulador. No se guarda. */
export interface ParametrosProyeccion {
  readonly horizonteMeses: number;
  /** Pesos por periodo; 0 = sin aportes. */
  readonly aportePeriodico: number;
  readonly frecuenciaAporte: Frecuencia;
  readonly reinvertirDividendos: boolean;
  /** Caída de todas las posiciones el día 0, en %. */
  readonly caidaInicialPct: number;
  readonly trayectorias: number;
  /** Entero de 32 bits sin signo: la misma semilla da exactamente el mismo resultado. */
  readonly semilla: number;
}

export type CodigoErrorParametro = "FALTA" | "NO_ES_NUMERO" | "NO_ES_ENTERO" | "FUERA_DE_RANGO" | "VALOR_NO_PERMITIDO" | "DEMASIADO_TRABAJO";
export interface ErrorParametro {
  readonly campo: keyof ParametrosProyeccion | "entrada";
  readonly codigo: CodigoErrorParametro;
}
export type Validacion = { readonly ok: true; readonly valor: ParametrosProyeccion } | { readonly ok: false; readonly errores: readonly ErrorParametro[] };

// ───────────── Entradas (las arma leer.ts) ─────────────
export interface Cierre {
  readonly dia: Date;
  /** Cierre SIN ajustar. */
  readonly precio: number;
}
export interface ValorUnidad {
  readonly dia: Date;
  readonly valorUnidad: number;
}
/** Lo que pagó Trii por TODA la tenencia, neto de retención (sin las fracciones de escisión). */
export interface DividendoLeido {
  readonly fechaPago: Date;
  readonly montoNeto: number;
  /** Siempre nulo desde la fase C (migración *_datos_oficiales): el enlace no se guarda; el cruce es por ventana (C5b). */
  readonly decretadoId: string | null;
}
export interface DecretoLeido {
  readonly id: string;
  /** La que publicó la fuente: manda qué tenencia cobró el pago de Trii que cruza con el decreto (src/proyecciones/dividendos.ts). */
  readonly fechaEx: Date;
  readonly fechaPago: Date;
  /** Valor decretado por acción (bruto). */
  readonly valorPorAccion: number;
  /** Tiene un dividendo recibido enlazado. Siempre falso desde la fase C (nadie enlaza: `decretadoId` es nulo). */
  readonly recibido: boolean;
}
export interface EscisionLeida {
  readonly origenId: string;
  readonly destinoId: string;
  readonly fecha: Date;
  /** Acciones nuevas por acción madre; null si no se registró. */
  readonly razon: number | null;
}
export interface AccionEntrada {
  readonly tipo: "ACCION";
  readonly instrumentoId: string;
  /** Nemotécnico. */
  readonly nombre: string;
  readonly cantidad: number;
  /** Ascendentes, uno por día (Yahoo, vigentes). */
  readonly cierres: readonly Cierre[];
  readonly dividendos: readonly DividendoLeido[];
  readonly decretos: readonly DecretoLeido[];
  /** Tenencia por fecha de operación (órdenes aprobadas y lotes de escisión). */
  readonly movimientos: readonly MovimientoTenencia[];
}
export interface FondoEntrada {
  readonly tipo: "FONDO";
  readonly instrumentoId: string;
  readonly nombre: string;
  readonly unidades: number;
  /** Ascendentes, uno por día (todos los días calendario que publique la SFC). */
  readonly valores: readonly ValorUnidad[];
}
export type PosicionEntrada = AccionEntrada | FondoEntrada;
export interface EntradasProyeccion {
  /** Fecha de negocio en Colombia: lo posterior no cuenta. */
  readonly hoy: Date;
  readonly posiciones: readonly PosicionEntrada[];
  readonly escisiones: readonly EscisionLeida[];
  /** Cierres de los destinos de las escisiones, por id. */
  readonly cierresDestino: Readonly<Record<string, readonly Cierre[]>>;
  readonly noHabiles: readonly Date[];
  /** Nemotécnicos de las especies con ventas sin asignar: quedan fuera. */
  readonly incompletas: readonly string[];
}

// ───────────── Historia (interna) ─────────────
export interface Historia {
  /** D días de la ventana; el primero es la base (sin retorno). */
  readonly dias: readonly Dia[];
  /** Retornos: D − 1. */
  readonly T: number;
  /** Columnas proyectadas. */
  readonly K: number;
  /** T × K, día-mayor: `factores[t·K + k]` = P(dias[t+1]) / P(dias[t]) de la columna k, ya ajustado. */
  readonly factores: Float64Array;
  /** T × K: dividendo por acción del día / precio del día anterior. */
  readonly rendimientos: Float64Array;
  readonly ruedasPorMes: number;
}

// ───────────── Resultado (JSON puro) ─────────────
export const AVISO = "Escenario ilustrativo, no es recomendación ni promesa." as const;

export interface PuntoProyeccion {
  readonly mes: number;
  readonly p5: number;
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly p95: number;
  /** Valor de hoy (antes de la caída) más los aportes hasta este mes. */
  readonly aportado: number;
  /** Mediana de los dividendos acumulados (reinvertidos o cobrados). */
  readonly dividendosP50: number;
}

export type EstadoPosicion = "PROYECTADA" | "FIJA_HISTORIA_CORTA" | "EXCLUIDA_SIN_VALOR";

export const CODIGOS_AVISO = [
  "HISTORIA_CORTA", "HISTORIA_CORTA_EN_VENTANA", "SIN_VALOR", "ESPECIE_INCOMPLETA", "ESCISION_SIN_RAZON", "ESCISION_SIN_CIERRE_DESTINO", "ESCISION_ENCADENADA",
  "SALTO_SIN_EVENTO", "DIVIDENDO_SIN_TENENCIA", "DIVIDENDO_TENENCIA_CAMBIA", "DIVIDENDO_DECRETO_EN_DUDA", "DIVIDENDO_EX_DISTINTAS", "DECRETO_BRUTO", "ANIO_SIN_CALENDARIO",
  "SIN_POSICIONES_PROYECTADAS", "SIN_POSICIONES_VALORADAS",
] as const;
export type CodigoAviso = (typeof CODIGOS_AVISO)[number];

export interface AvisoCrudo {
  readonly codigo: CodigoAviso;
  readonly instrumentoId: string | null;
  readonly nombre: string | null;
  readonly dia: Dia | null;
  /** Un dato numérico del aviso (el año, por ejemplo). */
  readonly dato: number | null;
}
export interface Aviso extends AvisoCrudo {
  readonly texto: string;
}

export interface PosicionSupuesta {
  readonly instrumentoId: string;
  readonly nombre: string;
  readonly tipo: "ACCION" | "FONDO";
  readonly estado: EstadoPosicion;
  /** null si no se puede valorar. */
  readonly valorHoy: number | null;
  /** Fracción del valor de hoy; null si no se puede valorar. */
  readonly peso: number | null;
  readonly diasEnVentana: number;
  /** Días hábiles con cierre (o valor de unidad) hasta hoy. */
  readonly diasTotales: number;
  readonly ultimoDia: Dia | null;
  readonly dividendosUsados: number;
  /** Primer día de la ventana con un dividendo conocido. */
  readonly primerDividendo: Dia | null;
}

export interface Ventana {
  readonly desde: Dia;
  readonly hasta: Dia;
  /** Días de la rejilla en la ventana. */
  readonly ruedas: number;
  /** Nombre de la posición de historia más corta, que fija el inicio. */
  readonly limitadaPor: string | null;
}

export interface Supuestos {
  readonly ventana: Ventana | null;
  readonly ruedasPorMes: number;
  readonly bloque: number;
  readonly minimoDias: number;
  /** Fracción del valor de hoy con riesgo modelado (el resto queda fijo). */
  readonly fraccionProyectada: number;
  /** Del portafolio de hoy con sus pesos, en la ventana: dato histórico, no promesa. */
  readonly rendimientoAnualVentana: number | null;
  readonly volatilidadAnualVentana: number | null;
  readonly decretosFuturos: number;
  readonly posiciones: readonly PosicionSupuesta[];
  readonly avisos: readonly Aviso[];
  readonly textos: readonly string[];
}

export interface ResultadoProyeccion {
  readonly aviso: typeof AVISO;
  readonly versionMetodo: string;
  readonly parametros: ParametrosProyeccion;
  readonly hoy: Dia;
  readonly valorHoy: number;
  readonly puntos: readonly PuntoProyeccion[];
  /** P(valor final + dividendos cobrados < lo aportado al final). */
  readonly probabilidadBajoAportado: number;
  /** Mediana entre trayectorias de la mayor caída desde un máximo (índice diario sin los aportes). */
  readonly caidaMaximaMediana: number;
  readonly supuestos: Supuestos;
}

export type Proyeccion = { readonly ok: true; readonly resultado: ResultadoProyeccion } | { readonly ok: false; readonly errores: readonly ErrorParametro[] };
