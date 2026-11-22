/**
 * Lo que recibe cada armador de hechos (E1b): subconjuntos (`Pick`) de las estructuras YA calculadas por los módulos de
 * 008. Quien llama pasa los objetos reales sin copiarlos; el armador solo lee estos campos. Por eso ninguna firma
 * trae la acción ni la cantidad de una regla, la tenencia, el texto libre de reglas o decisiones, el encargo, las
 * cuentas, las unidades del fondo, la referencia oficial de un decreto ni los textos de los avisos: aunque vengan en el
 * objeto, no se leen (lo prueban tests/unit/ia/hechos/candado.test.ts y pureza.candado.test.ts).
 * Los `import type` se borran al compilar: ningún armador carga la base ni `server-only`.
 */
import type { CorteDisponible } from "../../conciliacion/leer";
import type { Proximo } from "../../datos-oficiales/decretos/proximos";
import type { CifraOficial } from "../../datos-oficiales/series/consulta";
import type { Frescura as FrescuraSerie } from "../../datos-oficiales/series/frescura";
import type { CierreLeido, ReglaLeida } from "../../plan/lectura";
import type { CalendarioBvc } from "../../precios/negociacion";
import type { AvisoCrudo, ParametrosProyeccion, PosicionSupuesta, PuntoProyeccion, ResultadoProyeccion, Supuestos, Ventana } from "../../proyecciones/tipos";
import type { FilaTablero, Tablero } from "../../tablero/calculo";
import type { Movimiento, MovimientoEspecie } from "../../tablero/movimiento";
import type { DiaIso } from "../contrato";
import type { DecimalLike } from "./decimal";

// ───────────── DIARIO ─────────────

/** Una especie viva del tablero (`calcularTablero`). */
export type FilaParaHechos = Pick<FilaTablero, "instrumentoId" | "nemotecnico" | "valor" | "pesoPct" | "rentabilidadPct" | "cierre" | "cierreAtrasado">;

export interface TableroParaHechos extends Pick<Tablero,
  "valorAcciones" | "sinVender" | "porVentas" | "dividendos" | "comisiones" | "gananciaTotal" | "especiesSinPrecio" | "especiesAtrasadas"
  | "fechaReferencia" | "cierreMasViejo"> {
  /** Las vivas, en el orden del tablero (de mayor a menor valor). */
  readonly filas: readonly FilaParaHechos[];
}

/** «Qué movió su portafolio» (`calcularMovimiento`). */
export interface MovimientoParaHechos extends Pick<Movimiento, "neto" | "motivo"> {
  readonly especies: readonly Pick<MovimientoEspecie, "instrumentoId" | "aporte" | "variacionPct">[];
}

/** El último corte de la conciliación y su resultado (`ultimaConciliacion` de src/conciliacion/leer.ts). */
export type CorteParaHechos = Pick<CorteDisponible, "fechaCorte" | "resultado">;

/**
 * Una serie oficial: su último vigente y su frescura (`estadoSerie`), y el vigente anterior para la dirección. La fuente
 * tiene que ser exactamente la de su serie en el catálogo de datos oficiales (si no, FUENTE_DESCONOCIDA).
 */
export interface SerieParaHechos {
  /** TRM, TPM e IBR_3M_EA, oficiales; IPC_INDICE, la variación anual calculada por 008 (`variacionIndice`). */
  readonly cifra: Pick<CifraOficial, "serie" | "valor" | "hasta" | "fuente" | "origen">;
  readonly frescura: Pick<FrescuraSerie, "estado" | "cubreHoy">;
  /** El valor vigente anterior (texto decimal); null si no se sabe: la dirección queda NO_APLICA. */
  readonly anterior: string | null;
}

/** El valor de unidad del fondo, ya leído por quien llama. Su fuente es siempre la de la SFC (`FUENTES.FONDO`). */
export interface FondoParaHechos {
  readonly valorUnidad: DecimalLike;
  /** El valor de unidad anterior, para la dirección; null si no se sabe. */
  readonly valorUnidadAnterior: DecimalLike | null;
  readonly fecha: Date;
  /** El aviso de atraso del fondo (`DIAS_ATRASO_AVISO` de src/fondo/guardar.ts), calculado por quien llama. */
  readonly atrasado: boolean;
  /** Unidades × valor de unidad, si quien llama lo calculó; null si no (el armador no recibe las unidades). */
  readonly valor: DecimalLike | null;
}

export interface EntradaArmadoDiario {
  readonly hoy: DiaIso;
  readonly calendario: CalendarioBvc;
  readonly tablero: TableroParaHechos;
  readonly movimiento: MovimientoParaHechos;
  /** null si no hay ninguna certificación cargada. */
  readonly conciliacion: CorteParaHechos | null;
  readonly series: readonly SerieParaHechos[];
  /** null si no hay fondo. */
  readonly fondo: FondoParaHechos | null;
}

// ───────────── REGLAS ─────────────

/** Una regla de la versión vigente del plan (`leerReglas`). */
export type ReglaParaHechos = Pick<ReglaLeida, "instrumentoId" | "nemotecnico" | "condicion" | "nivel" | "plazoHasta">;

/** El último cierre de una especie (`ultimosCierres`). */
export type CierreParaReglas = Pick<CierreLeido, "fecha" | "precio" | "estado">;

/** Un próximo ex-dividendo (`proximos()` de src/datos-oficiales/decretos/proximos.ts). */
export type ProximoParaHechos = Pick<Proximo, "instrumentoId" | "nemotecnico" | "valorPorAccion" | "fechaAnuncio" | "fechaEx" | "fechaPago" | "brutoEstimado">;

export interface EntradaArmadoReglas {
  readonly hoy: DiaIso;
  readonly calendario: CalendarioBvc;
  /** El día desde el que rige la versión vigente del plan (`vigenteEn` de src/app/plan/vista.ts). */
  readonly vigenteDesde: Date;
  readonly reglas: readonly ReglaParaHechos[];
  /** El último cierre de cada especie, por instrumentoId. */
  readonly cierres: ReadonlyMap<string, CierreParaReglas>;
  /** La fecha de referencia del tablero (el cierre más reciente entre las vivas): con ella se sabe si un cierre está al día. */
  readonly referencia: Date | null;
  readonly proximos: readonly ProximoParaHechos[];
}

// ───────────── ESCENARIOS ─────────────

/** Un ResultadoProyeccion, calculado con los parámetros fijos del resumen (horizonte de doce meses). */
export interface ResultadoParaHechos extends Pick<ResultadoProyeccion, "hoy" | "valorHoy" | "versionMetodo" | "probabilidadBajoAportado" | "caidaMaximaMediana"> {
  readonly parametros: Pick<ParametrosProyeccion, "horizonteMeses">;
  readonly puntos: readonly Pick<PuntoProyeccion, "mes" | "p5" | "p50" | "p95" | "aportado">[];
  readonly supuestos: Pick<Supuestos, "fraccionProyectada" | "rendimientoAnualVentana" | "volatilidadAnualVentana"> & {
    readonly ventana: Pick<Ventana, "desde" | "hasta"> | null;
    readonly posiciones: readonly Pick<PosicionSupuesta, "nombre" | "tipo" | "estado" | "diasTotales">[];
    readonly avisos: readonly Pick<AvisoCrudo, "codigo">[];
  };
}

export interface EntradaArmadoEscenarios {
  readonly hoy: DiaIso;
  readonly resultado: ResultadoParaHechos;
}
