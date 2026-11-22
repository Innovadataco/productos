/**
 * Catálogo cerrado de claves de `hechos-v1`, por tipo de resumen. Cada clave trae su etiqueta genérica en español, su
 * unidad y si se refiere a una especie, si admite dirección y si admite cercanía. Es la única fuente de la etiqueta y
 * de la unidad de un hecho: `construirPaquete` las toma de aquí.
 *
 * Reglas (las cuida `tests/unit/ia/catalogo.test.ts`):
 * - las claves son identificadores en mayúsculas SIN dígitos (la vista ciega no lleva dígitos fuera de los ids);
 * - ninguna etiqueta lleva dígitos, cifras en palabras ni nombres de especie; los horizontes son corto, medio y
 *   largo, y el «3 meses» lo pone el código en la presentación del hecho;
 * - el nombre de la especie es un hecho propio (ESPECIE_NOMBRE); los hechos de una especie lo citan en `sujeto`;
 * - varias reglas por especie (decisión de la Fábrica, E1b): cada regla tiene su hecho ancla (REGLA_DEL_PLAN, solo en
 *   REGLAS). Los hechos de la regla (`CLAVES_DE_REGLA`) citan como `sujeto` a su ancla, y el ancla cita a la especie
 *   (o a nadie, si la regla es de portafolio). Así dos reglas de la misma especie no chocan en HECHO_REPETIDO.
 */
import type { TipoResumen, Unidad } from "./contrato";

export const CLAVE_NOMBRE_ESPECIE = "ESPECIE_NOMBRE";
export type ClaveNombreEspecie = typeof CLAVE_NOMBRE_ESPECIE;

/** El ancla de una regla del plan (solo en REGLAS): su valor es el día desde el que rige la versión del plan. */
export const CLAVE_ANCLA_REGLA = "REGLA_DEL_PLAN";
export type ClaveAnclaRegla = typeof CLAVE_ANCLA_REGLA;

export type ClaveDiario =
  | ClaveNombreEspecie
  | "VALOR_ACCIONES" | "GANANCIA_SIN_VENDER" | "GANANCIA_POR_VENTAS" | "DIVIDENDOS_RECIBIDOS" | "COMISIONES_PAGADAS" | "GANANCIA_TOTAL"
  | "VARIACION_DIA_VALOR" | "VARIACION_DIA_PORCENTAJE" | "ESPECIES_SIN_PRECIO" | "ESPECIES_ATRASADAS"
  | "FECHA_CIERRE_RECIENTE" | "FECHA_CIERRE_MAS_ANTIGUO"
  | "CONCILIACION_CUADRA" | "CONCILIACION_PARCIAL" | "CONCILIACION_NO_CUADRA"
  | "TASA_TRM" | "TASA_TPM" | "TASA_IBR" | "VARIACION_ANUAL_IPC"
  | "FONDO_VALOR" | "FONDO_VALOR_UNIDAD" | "FONDO_FECHA_VALOR"
  | "VALOR_ESPECIE" | "PESO_ESPECIE" | "RENTABILIDAD_ESPECIE" | "CIERRE_ESPECIE" | "FECHA_CIERRE_ESPECIE" | "VARIACION_DIA_ESPECIE";

export type ClaveReglas =
  | ClaveNombreEspecie
  | "CIERRE_ESPECIE" | "FECHA_CIERRE_ESPECIE"
  | "REGLA_NIVEL" | "REGLA_TOCADA" | "REGLA_EN_EL_NIVEL" | "REGLA_DISTANCIA" | "REGLA_SIN_CIERRE_AL_DIA"
  | "REGLA_PLAZO" | "REGLA_DIAS_AL_PLAZO"
  | "PROXIMO_EX_DIVIDENDO" | "DIAS_A_EX_DIVIDENDO" | "DIVIDENDO_POR_ACCION" | "DIVIDENDO_FECHA_PAGO" | "DIVIDENDO_BRUTO_ESTIMADO"
  | ClaveAnclaRegla;

/** Los hechos de una regla: los únicos que pueden citar a un ancla (REGLA_DEL_PLAN) como `sujeto`. El ancla no está. */
export type ClaveDeRegla = (typeof LISTA_DE_REGLA)[number];

export type ClaveEscenarios =
  | ClaveNombreEspecie
  | "VALOR_INICIAL" | "HORIZONTE_CORTO" | "HORIZONTE_MEDIO" | "HORIZONTE_LARGO"
  | "ESCENARIO_BAJO_CORTO" | "ESCENARIO_BAJO_MEDIO" | "ESCENARIO_BAJO_LARGO"
  | "ESCENARIO_CENTRAL_CORTO" | "ESCENARIO_CENTRAL_MEDIO" | "ESCENARIO_CENTRAL_LARGO"
  | "ESCENARIO_ALTO_CORTO" | "ESCENARIO_ALTO_MEDIO" | "ESCENARIO_ALTO_LARGO"
  | "APORTADO_CORTO" | "APORTADO_MEDIO" | "APORTADO_LARGO"
  | "PROBABILIDAD_BAJO_APORTADO" | "CAIDA_MAXIMA_MEDIANA" | "VOLATILIDAD_ANUAL" | "RENDIMIENTO_ANUAL_HISTORICO" | "FRACCION_PROYECTADA"
  | "VENTANA_DESDE" | "VENTANA_HASTA" | "DIAS_HISTORIA_ESPECIE";

export type ClaveHecho = ClaveDiario | ClaveReglas | ClaveEscenarios;

/** Las claves del catálogo de un tipo. */
export type ClaveDe<T extends TipoResumen> = { readonly DIARIO: ClaveDiario; readonly REGLAS: ClaveReglas; readonly ESCENARIOS: ClaveEscenarios }[T];

/** Si un hecho de la clave se refiere a una especie (su `sujeto`, el id de un hecho ESPECIE_NOMBRE anterior). */
export type PoliticaSujeto = "EXIGIDO" | "OPCIONAL" | "NINGUNO";

export interface EntradaCatalogo {
  readonly etiqueta: string;
  readonly unidad: Unidad;
  readonly politicaSujeto: PoliticaSujeto;
  /** Si no, la dirección del hecho es NO_APLICA. */
  readonly admiteDireccion: boolean;
  /** Si no, la cercanía del hecho es NO_APLICA. */
  readonly admiteCercania: boolean;
}

export type Catalogo = { readonly [T in TipoResumen]: Readonly<Record<ClaveDe<T>, EntradaCatalogo>> };

interface Opciones {
  readonly sujeto?: PoliticaSujeto;
  readonly direccion?: boolean;
  readonly cercania?: boolean;
}

function entrada(etiqueta: string, unidad: Unidad, opciones: Opciones = {}): EntradaCatalogo {
  return Object.freeze({
    etiqueta,
    unidad,
    politicaSujeto: opciones.sujeto ?? "NINGUNO",
    admiteDireccion: opciones.direccion ?? false,
    admiteCercania: opciones.cercania ?? false,
  });
}

const CON_DIRECCION: Opciones = { direccion: true };
const DE_ESPECIE: Opciones = { sujeto: "EXIGIDO" };
const DE_ESPECIE_CON_DIRECCION: Opciones = { sujeto: "EXIGIDO", direccion: true };

const NOMBRE_ESPECIE = entrada("nombre de la especie", "NOMBRE");
const CIERRE_ESPECIE = entrada("precio de cierre de la especie", "PESOS", DE_ESPECIE_CON_DIRECCION);
const FECHA_CIERRE_ESPECIE = entrada("fecha del cierre de la especie", "FECHA", DE_ESPECIE);

const DIARIO: Readonly<Record<ClaveDiario, EntradaCatalogo>> = Object.freeze({
  ESPECIE_NOMBRE: NOMBRE_ESPECIE,
  VALOR_ACCIONES: entrada("valor de las acciones", "PESOS", CON_DIRECCION),
  GANANCIA_SIN_VENDER: entrada("ganancia sin vender", "PESOS", CON_DIRECCION),
  GANANCIA_POR_VENTAS: entrada("ganancia por ventas", "PESOS", CON_DIRECCION),
  DIVIDENDOS_RECIBIDOS: entrada("dividendos recibidos", "PESOS", CON_DIRECCION),
  COMISIONES_PAGADAS: entrada("comisiones pagadas", "PESOS", CON_DIRECCION),
  GANANCIA_TOTAL: entrada("ganancia total", "PESOS", CON_DIRECCION),
  VARIACION_DIA_VALOR: entrada("variación del día del valor de las acciones", "PESOS", CON_DIRECCION),
  VARIACION_DIA_PORCENTAJE: entrada("variación del día en porcentaje", "PORCENTAJE", CON_DIRECCION),
  ESPECIES_SIN_PRECIO: entrada("especies sin precio", "ESPECIES"),
  ESPECIES_ATRASADAS: entrada("especies con cierre atrasado", "ESPECIES"),
  FECHA_CIERRE_RECIENTE: entrada("fecha del cierre más reciente", "FECHA"),
  FECHA_CIERRE_MAS_ANTIGUO: entrada("fecha del cierre más antiguo", "FECHA"),
  CONCILIACION_CUADRA: entrada("corte de la conciliación que cuadra", "FECHA"),
  CONCILIACION_PARCIAL: entrada("corte de la conciliación que cuadra en parte", "FECHA"),
  CONCILIACION_NO_CUADRA: entrada("corte de la conciliación que no cuadra", "FECHA"),
  TASA_TRM: entrada("tasa de cambio representativa del mercado (TRM)", "PESOS_POR_DOLAR", CON_DIRECCION),
  TASA_TPM: entrada("tasa de política monetaria (TPM)", "PORCENTAJE", CON_DIRECCION),
  TASA_IBR: entrada("indicador bancario de referencia (IBR)", "PORCENTAJE", CON_DIRECCION),
  VARIACION_ANUAL_IPC: entrada("variación anual del índice de precios al consumidor (IPC)", "PORCENTAJE", CON_DIRECCION),
  FONDO_VALOR: entrada("valor del fondo", "PESOS", CON_DIRECCION),
  FONDO_VALOR_UNIDAD: entrada("valor de la unidad del fondo", "PESOS", CON_DIRECCION),
  FONDO_FECHA_VALOR: entrada("fecha del valor del fondo", "FECHA"),
  VALOR_ESPECIE: entrada("valor de la especie", "PESOS", DE_ESPECIE_CON_DIRECCION),
  PESO_ESPECIE: entrada("peso de la especie en el portafolio", "PORCENTAJE", DE_ESPECIE_CON_DIRECCION),
  RENTABILIDAD_ESPECIE: entrada("rentabilidad sin vender de la especie", "PORCENTAJE", DE_ESPECIE_CON_DIRECCION),
  CIERRE_ESPECIE,
  FECHA_CIERRE_ESPECIE,
  VARIACION_DIA_ESPECIE: entrada("variación del día de la especie", "PORCENTAJE", DE_ESPECIE_CON_DIRECCION),
});

const REGLAS: Readonly<Record<ClaveReglas, EntradaCatalogo>> = Object.freeze({
  ESPECIE_NOMBRE: NOMBRE_ESPECIE,
  CIERRE_ESPECIE,
  FECHA_CIERRE_ESPECIE,
  REGLA_NIVEL: entrada("nivel de la regla", "PESOS", DE_ESPECIE),
  REGLA_TOCADA: entrada("regla tocada", "FECHA", DE_ESPECIE_CON_DIRECCION),
  REGLA_EN_EL_NIVEL: entrada("cierre justo en el nivel de la regla", "FECHA", DE_ESPECIE),
  REGLA_DISTANCIA: entrada("distancia al nivel de la regla", "PORCENTAJE", { sujeto: "EXIGIDO", direccion: true, cercania: true }),
  REGLA_SIN_CIERRE_AL_DIA: entrada("regla sin cierre al día", "FECHA", DE_ESPECIE),
  REGLA_PLAZO: entrada("plazo de la regla", "FECHA", { sujeto: "OPCIONAL" }),
  REGLA_DIAS_AL_PLAZO: entrada("días que faltan para el plazo de la regla", "DIAS", { sujeto: "OPCIONAL", cercania: true }),
  PROXIMO_EX_DIVIDENDO: entrada("fecha ex del próximo dividendo", "FECHA", DE_ESPECIE),
  DIAS_A_EX_DIVIDENDO: entrada("días que faltan para la fecha ex del dividendo", "DIAS", { sujeto: "EXIGIDO", cercania: true }),
  DIVIDENDO_POR_ACCION: entrada("dividendo decretado por acción", "PESOS", DE_ESPECIE),
  DIVIDENDO_FECHA_PAGO: entrada("fecha de pago del dividendo", "FECHA", DE_ESPECIE),
  DIVIDENDO_BRUTO_ESTIMADO: entrada("dividendo bruto estimado", "PESOS", DE_ESPECIE),
  REGLA_DEL_PLAN: entrada("regla del plan vigente desde", "FECHA", { sujeto: "OPCIONAL" }),
});

const ESCENARIOS: Readonly<Record<ClaveEscenarios, EntradaCatalogo>> = Object.freeze({
  ESPECIE_NOMBRE: NOMBRE_ESPECIE,
  VALOR_INICIAL: entrada("valor de partida de la proyección", "PESOS"),
  HORIZONTE_CORTO: entrada("horizonte corto", "MESES"),
  HORIZONTE_MEDIO: entrada("horizonte medio", "MESES"),
  HORIZONTE_LARGO: entrada("horizonte largo", "MESES"),
  ESCENARIO_BAJO_CORTO: entrada("escenario bajo a corto plazo", "PESOS", CON_DIRECCION),
  ESCENARIO_BAJO_MEDIO: entrada("escenario bajo a medio plazo", "PESOS", CON_DIRECCION),
  ESCENARIO_BAJO_LARGO: entrada("escenario bajo a largo plazo", "PESOS", CON_DIRECCION),
  ESCENARIO_CENTRAL_CORTO: entrada("escenario central a corto plazo", "PESOS", CON_DIRECCION),
  ESCENARIO_CENTRAL_MEDIO: entrada("escenario central a medio plazo", "PESOS", CON_DIRECCION),
  ESCENARIO_CENTRAL_LARGO: entrada("escenario central a largo plazo", "PESOS", CON_DIRECCION),
  ESCENARIO_ALTO_CORTO: entrada("escenario alto a corto plazo", "PESOS", CON_DIRECCION),
  ESCENARIO_ALTO_MEDIO: entrada("escenario alto a medio plazo", "PESOS", CON_DIRECCION),
  ESCENARIO_ALTO_LARGO: entrada("escenario alto a largo plazo", "PESOS", CON_DIRECCION),
  APORTADO_CORTO: entrada("lo aportado a corto plazo", "PESOS"),
  APORTADO_MEDIO: entrada("lo aportado a medio plazo", "PESOS"),
  APORTADO_LARGO: entrada("lo aportado a largo plazo", "PESOS"),
  PROBABILIDAD_BAJO_APORTADO: entrada("probabilidad de terminar por debajo de lo aportado", "PORCENTAJE"),
  CAIDA_MAXIMA_MEDIANA: entrada("caída máxima mediana", "PORCENTAJE"),
  VOLATILIDAD_ANUAL: entrada("volatilidad anual histórica", "PORCENTAJE"),
  RENDIMIENTO_ANUAL_HISTORICO: entrada("rendimiento anual histórico", "PORCENTAJE", CON_DIRECCION),
  FRACCION_PROYECTADA: entrada("parte del valor con riesgo modelado", "PORCENTAJE"),
  VENTANA_DESDE: entrada("inicio de la historia usada", "FECHA"),
  VENTANA_HASTA: entrada("fin de la historia usada", "FECHA"),
  DIAS_HISTORIA_ESPECIE: entrada("días de historia de la especie", "DIAS", DE_ESPECIE),
});

export const CATALOGO: Catalogo = Object.freeze({ DIARIO, REGLAS, ESCENARIOS });

/** La entrada de la clave en el catálogo del tipo, o null (también para «constructor», «__proto__» y similares). */
export function entradaDeCatalogo(tipo: TipoResumen, clave: string): EntradaCatalogo | null {
  if (!Object.hasOwn(CATALOGO, tipo)) return null;
  const delTipo: Readonly<Record<string, EntradaCatalogo>> = CATALOGO[tipo];
  return Object.hasOwn(delTipo, clave) ? (delTipo[clave] as EntradaCatalogo) : null;
}

/** Las claves del tipo, en el orden del catálogo. */
export function clavesDe<T extends TipoResumen>(tipo: T): readonly ClaveDe<T>[] {
  return Object.freeze(Object.keys(CATALOGO[tipo]) as ClaveDe<T>[]);
}

/** Una sola fuente de las claves de regla: `satisfies` rechaza en compilación una que no sea del catálogo de REGLAS. */
const LISTA_DE_REGLA = [
  "REGLA_NIVEL", "REGLA_TOCADA", "REGLA_EN_EL_NIVEL", "REGLA_DISTANCIA", "REGLA_SIN_CIERRE_AL_DIA", "REGLA_PLAZO", "REGLA_DIAS_AL_PLAZO",
] as const satisfies readonly ClaveReglas[];

export const CLAVES_DE_REGLA: readonly ClaveDeRegla[] = Object.freeze([...LISTA_DE_REGLA]);

/** ¿Es la clave un hecho de regla, que puede citar a un ancla como `sujeto`? */
export function esClaveDeRegla(clave: string): clave is ClaveDeRegla {
  return (CLAVES_DE_REGLA as readonly string[]).includes(clave);
}
