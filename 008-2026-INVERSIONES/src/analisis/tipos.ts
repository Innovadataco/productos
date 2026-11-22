/**
 * Tipos del motor de análisis del portafolio (fase E, hito A1). Puro: sin base, sin red y sin reloj.
 * El motor mide y señala dónde mirar; no propone operaciones ni califica especies. La decisión es del dueño.
 * - Entradas: las arman lectores que ya existen (A2 los llama): `leerEntradas` (src/proyecciones/leer.ts), el tablero
 *   de `calcularTablero` (src/tablero/calculo.ts) y `resultadosDeDecisiones` (src/plan/resultados-lote.ts).
 * - Portafolio: las ACCIONES vivas del tablero, con sus pesos (el dueño del valor y del peso es el tablero). El fondo
 *   FIC queda fuera en la v1.
 * - Dinero en `Prisma.Decimal`; métricas estadísticas en `number`, redondeadas a DECIMALES_METRICA (numeros.ts); días
 *   `AAAA-MM-DD`. El motor no da formato: eso es de la pantalla.
 * - Sin nombres: solo ids (la pantalla los cruza con el tablero). Aun así, el análisis NO es un paquete de hechos para la
 *   IA: sus claves (instrumentoId, especies, reglaId, decisionId…) son las que prohíbe src/ia/prohibidas.ts, y la guarda
 *   lo rechaza entero. La vista ciega se arma aparte desde aquí, con ids opacos; nunca se afloja esa lista.
 */
import type { Prisma } from "@prisma/client";
import type { ReglaLeida } from "../plan/lectura";
import type { HorizonteDias, Veredicto } from "../plan/resultado";
import type { ResultadoDecision } from "../plan/resultados-lote";
import type { AvisoCrudo, Dia, EntradasProyeccion } from "../proyecciones/tipos";
import type { Tablero } from "../tablero/calculo";

/** Cambia si cambia el cálculo: la pantalla la muestra y permite comparar análisis. */
export const VERSION_ANALISIS = "analisis-v1";

/** Ventanas del rendimiento, en meses calendario (ventanas.ts). */
export const VENTANAS_MESES = [1, 3, 6, 12] as const;
export type VentanaMeses = (typeof VENTANAS_MESES)[number];

// ───────────── Entradas ─────────────
export interface EntradasAnalisis {
  /** Fecha de negocio en Colombia (medianoche UTC). Lo posterior no cuenta. */
  readonly hoy: Date;
  /** De `leerEntradas`: cierres de Yahoo, dividendos, decretos (también los de fecha ex futura), tenencia, escisiones y calendario. */
  readonly historia: EntradasProyeccion;
  /** De `calcularTablero`: valor, último cierre y fecha de referencia de cada especie. */
  readonly tablero: Tablero;
  /** De `resultadosDeDecisiones`, que calcula con src/plan/resultado.ts. */
  readonly decisiones: readonly ResultadoDecision[];
}

/** Lo que el motor necesita de una regla. Ni la acción, ni la cantidad, ni el texto libre: nunca entran al análisis. */
export type ReglaParaAnalisis = Pick<ReglaLeida, "id" | "instrumentoId" | "condicion" | "nivel" | "plazoHasta">;

/** Las reglas de la versión VIGENTE del plan (quien llama la elige, como /plan con `vigenteEn`). */
export interface PlanParaAnalisis {
  readonly reglas: readonly ReglaParaAnalisis[];
}

// ───────────── Cierre y su frescura ─────────────
/**
 * El último cierre de la especie (del tablero: cualquier fuente) frente a la fecha de referencia, con la regla de
 * `frescuraDelCierre` (src/plan/cierre-frescura.ts), la misma de /plan.
 */
export type EstadoCierre =
  | { readonly estado: "SIN_CIERRE" }
  | { readonly estado: "AL_DIA"; readonly dia: Dia; readonly precio: Prisma.Decimal }
  | { readonly estado: "SIN_NEGOCIACION"; readonly dia: Dia; readonly precio: Prisma.Decimal; readonly desde: Dia }
  | { readonly estado: "SIN_CALENDARIO"; readonly dia: Dia; readonly precio: Prisma.Decimal; readonly anio: number };

/** Una especie del tablero sin cantidad viva: solo su cierre, para medir las reglas que la citan. */
export interface CierreSinTenencia {
  readonly instrumentoId: string;
  readonly cierre: EstadoCierre;
}

// ───────────── Historia propia de la especie ─────────────
export type VentanaRendimiento =
  | {
      readonly meses: VentanaMeses;
      readonly estado: "CALCULADA";
      /** La última rueda con cierre en o antes de (hasta − meses). */
      readonly desde: Dia;
      /** El último cierre propio (no hoy: una especie atrasada termina antes). */
      readonly hasta: Dia;
      /** Retornos diarios dentro de la ventana. */
      readonly ruedas: number;
      /** Solo el precio, ajustado por escisiones y saltos. */
      readonly precio: number;
      /** Precio más los dividendos del día del pago, reinvertidos. */
      readonly total: number;
    }
  | { readonly meses: VentanaMeses; readonly estado: "HISTORIA_NO_ALCANZA" };

/** La mayor caída del precio ajustado desde un máximo previo, en toda la historia propia. */
export type CaidaMaxima =
  | { readonly estado: "SIN_CAIDA" }
  | {
      readonly estado: "CAIDA";
      /** Fracción perdida desde el pico, positiva: 0,25 es una caída del 25 %. */
      readonly fraccion: number;
      readonly pico: Dia;
      readonly valle: Dia;
    };

export type HistoriaPropia =
  | {
      readonly estado: "CON_HISTORIA";
      readonly desde: Dia;
      readonly hasta: Dia;
      /** Días con cierre propio en la historia. */
      readonly dias: number;
      /** Una por cada mes de VENTANAS_MESES, en ese orden. */
      readonly ventanas: readonly VentanaRendimiento[];
      readonly caidaMaxima: CaidaMaxima;
    }
  /** Menos de MINIMO_DIAS días con cierre (src/proyecciones/metodo.ts): no se calcula nada. */
  | { readonly estado: "HISTORIA_CORTA"; readonly dias: number }
  | { readonly estado: "SIN_CIERRES" };

/** Dividendos por acción con pago en (hoy − 12 meses, hoy] sobre el último cierre del tablero. */
export interface RendimientoDividendo {
  readonly fraccion: number;
  readonly pagos: number;
  /** Algún decreto entró con su valor BRUTO (no hubo pago de Trii que cruzara): ver src/proyecciones/dividendos.ts. */
  readonly conBruto: boolean;
  /** Pagos de la ventana que no entraron (no se supo qué tenencia los cobró): el rendimiento queda por debajo. */
  readonly descartados: number;
}

// ───────────── Riesgo ─────────────
/**
 * Descomposición de Euler de la volatilidad anual del portafolio cubierto:
 * - marginal = ∂σp/∂w = (Σ w)ₖ / σp;
 * - contribución = w × marginal (suman σp);
 * - contribución porcentual = contribución / σp (suman 1).
 */
export interface ContribucionRiesgo {
  readonly marginal: number;
  readonly contribucion: number;
  readonly contribucionPct: number;
}

export type MotivoSinHistoria = "HISTORIA_CORTA" | "HISTORIA_CORTA_EN_VENTANA" | "SIN_CIERRES";

export type RiesgoEspecie =
  | {
      readonly estado: "CUBIERTA";
      /** De los retornos diarios de precio de la ventana común. */
      readonly volatilidadAnual: number;
      /** Su valor sobre el de las especies cubiertas. */
      readonly pesoCubierto: number;
      /** null si la volatilidad del portafolio es cero: no hay riesgo que repartir. */
      readonly contribucion: ContribucionRiesgo | null;
    }
  /** Sin historia suficiente en la ventana común: ni correlación ni contribución. No se inventan. */
  | { readonly estado: "SIN_HISTORIA"; readonly motivo: MotivoSinHistoria; readonly dias: number }
  /** Sin valor en el tablero (sin cierre): no tiene peso. */
  | { readonly estado: "SIN_VALOR" };

export interface MatrizCorrelacion {
  /** Las especies cubiertas, en el orden de la matriz. */
  readonly ids: readonly string[];
  /** Simétrica; null en la fila y la columna de una especie cuyo precio no varió en la ventana. */
  readonly valores: readonly (readonly (number | null)[])[];
}

/** La ventana común de armarHistoria, sin el nombre de la especie que la limita (es la cubierta de historia más corta). */
export interface VentanaComun {
  readonly desde: Dia;
  readonly hasta: Dia;
  /** Días de la rejilla en la ventana. */
  readonly ruedas: number;
}

export type RiesgoPortafolio =
  | {
      readonly estado: "CALCULADO";
      readonly ventana: VentanaComun;
      /** A en √A: 12 × ruedasPorMes de la ventana común, el factor de la volatilidad histórica de las proyecciones. */
      readonly factorAnualizacion: number;
      readonly volatilidadAnual: number;
      /** Valor de las especies cubiertas sobre el valor de las acciones. */
      readonly fraccionCubierta: number;
      readonly correlacion: MatrizCorrelacion;
    }
  | { readonly estado: "SIN_HISTORIA" };

/** Efecto en el portafolio de una caída de la especie igual a su caída máxima histórica (las demás quietas). */
export interface EfectoCaida {
  /** Cero o negativo. */
  readonly pesos: Prisma.Decimal;
  /** pesos / valor de las acciones: cero o negativo. */
  readonly fraccionPortafolio: number;
}

// ───────────── Resultado ─────────────
export interface AnalisisEspecie {
  readonly instrumentoId: string;
  /** Del tablero; null si no tiene cierre. */
  readonly valor: Prisma.Decimal | null;
  /** valor / valor de las acciones; null si no tiene valor. */
  readonly peso: number | null;
  readonly cierre: EstadoCierre;
  readonly historia: HistoriaPropia;
  /** null sin cierre o sin historia de dividendos (la especie no está en la historia). */
  readonly dividendo12m: RendimientoDividendo | null;
  readonly riesgo: RiesgoEspecie;
  /** null sin valor o sin historia propia. */
  readonly efectoCaida: EfectoCaida | null;
  /** El decreto que cuenta con la fecha ex más próxima, hoy o después. */
  readonly proximaEx: { readonly dia: Dia; readonly decretoId: string } | null;
}

export interface Concentracion {
  /** Especies con valor positivo. */
  readonly especies: number;
  readonly primera: { readonly instrumentoId: string; readonly peso: number };
  /** Hasta tres, de mayor a menor valor. */
  readonly tresPrimeras: { readonly instrumentoIds: readonly string[]; readonly peso: number };
  /** Índice de Herfindahl-Hirschman: Σ peso². Queda en [1/n, 1]. */
  readonly hhi: number;
  /** 1 / HHI: cuántas especies de igual peso tendrían el mismo HHI. */
  readonly especiesEfectivas: number;
}

export interface ResumenHorizonte {
  readonly horizonteDias: HorizonteDias;
  readonly veredictos: Readonly<Record<Veredicto, number>>;
  /** Calculadas sin veredicto (escisión en la ventana): su resultado en pesos no entra al total. */
  readonly sinVeredicto: number;
  readonly pendientes: number;
  readonly sinPrecio: number;
  readonly sinOrden: number;
  /** Suma de los resultados en pesos de las que tienen veredicto. */
  readonly totalPesos: Prisma.Decimal;
  /** De las que entran al total: sin dividendos medidos (solo el precio) y con algún cierre sin verificar. */
  readonly sinDividendos: number;
  readonly noVerificadas: number;
}

export interface MedidaDecision {
  readonly decisionId: string;
  readonly horizonteDias: HorizonteDias;
  readonly veredicto: Veredicto;
  readonly resultadoPesos: Prisma.Decimal;
  /** La mayor fecha objetivo de sus tramos: el día en que el resultado se pudo conocer. */
  readonly conocidoEl: Dia;
}

export interface ResumenDecisiones {
  readonly d30: ResumenHorizonte;
  readonly d90: ResumenHorizonte;
  /** Las que tienen veredicto, por decisión y horizonte. */
  readonly medidas: readonly MedidaDecision[];
}

/** Un aviso de la historia (src/proyecciones/tipos.ts) sin el nombre de la especie. */
export type AvisoAnalisis = Omit<AvisoCrudo, "nombre">;

export interface Analisis {
  readonly version: typeof VERSION_ANALISIS;
  readonly hoy: Dia;
  readonly valorAcciones: Prisma.Decimal;
  /** El cierre más reciente entre las especies vivas (del tablero); null si ninguna tiene cierre. */
  readonly referencia: {
    readonly dia: Dia;
    /** La carga de precios se detuvo: la referencia es anterior al último día hábil antes de hoy (`preciosAtrasados`). */
    readonly cargaDetenida: boolean;
  } | null;
  /** De mayor a menor valor (sin valor al final); en un empate, por id. */
  readonly especies: readonly AnalisisEspecie[];
  /** Por id. */
  readonly sinTenencia: readonly CierreSinTenencia[];
  /** null sin especies con valor. */
  readonly concentracion: Concentracion | null;
  readonly riesgo: RiesgoPortafolio;
  readonly decisiones: ResumenDecisiones;
  /** Los de las historias, sin el nombre, sin repetir y ordenados. */
  readonly avisos: readonly AvisoAnalisis[];
}
