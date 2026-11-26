/**
 * Contrato `hechos-v1` de los resúmenes con IA (fase E): las constantes cerradas y los tipos que comparten los armadores
 * de hechos, el validador, el esquema y los clientes de las dos puertas. Solo tipos, constantes y `esIdHecho`.
 *
 * Regla de fondo: el código calcula y presenta cada cifra; el modelo, local o en la nube, solo recibe la vista ciega
 * (`vista-ciega.ts`) y cita los hechos por su id (`{H01}`). Cambiar una lista o un campo es un cambio de contrato:
 * después de activar la IA, pasa a `hechos-v2`.
 */
import type { ClaveDe, ClaveHecho } from "./catalogo";

export const VERSION_HECHOS = "hechos-v1";
export type VersionHechos = typeof VERSION_HECHOS;
/** El contrato de los paquetes SIMULACION: hechos con `rango` e `importancia`. Los tres de hoy siguen en `hechos-v1`, con el mismo hash. */
export const VERSION_HECHOS_V2 = "hechos-v2";
export type VersionHechosV2 = typeof VERSION_HECHOS_V2;

/**
 * Los tipos del contrato, en el orden del enum de la base (`TipoResumenIa`; ADD VALUE agrega al final, así que SIMULACION
 * va última). SIMULACION es a demanda, solo del dueño y por la puerta local: nunca sale en la corrida diaria, en una
 * tarjeta ni en una lectura de la familia (ver TIPOS_DIARIOS y `candados/tipos-diarios.candado.test.ts`).
 */
export const TIPOS_RESUMEN = Object.freeze(["DIARIO", "REGLAS", "ESCENARIOS", "SIMULACION"] as const);
export type TipoResumen = (typeof TIPOS_RESUMEN)[number];

/** Los tres tipos de hoy: los únicos que recorren la corrida diaria, las tarjetas, `ahora.ts` y la exportación. */
export const TIPOS_DIARIOS = Object.freeze(["DIARIO", "REGLAS", "ESCENARIOS"] as const satisfies readonly TipoResumen[]);
export type TipoDiario = (typeof TIPOS_DIARIOS)[number];

/** Calidad del dato: de la fuente verificada, sin verificar, estimado, calculado por 008 o atrasado. */
export const CALIDADES = Object.freeze(["VERIFICADO", "NO_VERIFICADO", "ESTIMADO", "CALCULADO", "ATRASADO"] as const);
export type Calidad = (typeof CALIDADES)[number];

/** Hacia dónde se movió el dato frente a su referencia; NO_APLICA si la clave no tiene dirección. */
export const DIRECCIONES = Object.freeze(["SUBE", "BAJA", "IGUAL", "NO_APLICA"] as const);
export type Direccion = (typeof DIRECCIONES)[number];

/** Si el dato está cerca de un umbral (un nivel, un plazo, una fecha ex); NO_APLICA si la clave no tiene umbral. */
export const CERCANIAS = Object.freeze(["CERCA", "LEJOS", "NO_APLICA"] as const);
export type Cercania = (typeof CERCANIAS)[number];

/** Qué tan reciente es el dato frente a `hoy` (la fecha relativa que sí ve el modelo). */
export const FRESCURAS = Object.freeze(["HOY", "RECIENTE", "ATRASADO"] as const);
export type Frescura = (typeof FRESCURAS)[number];

/** La importancia de un punto, la que le da su rango en `TRAMOS` (src/analisis/puntos/rangos.ts). */
export const IMPORTANCIAS = Object.freeze(["ALTA", "MEDIA", "BAJA"] as const);
export type Importancia = (typeof IMPORTANCIAS)[number];

/**
 * Unidad del valor. La fija el catálogo por clave (nunca quien arma el hecho).
 * - PORCENTAJE va en puntos: «12.3» es 12,3 %.
 * - DIAS, MESES y ESPECIES son enteros; MESES y ESPECIES, además, no negativos.
 * - FECHA: el valor es un día ISO. NOMBRE: el valor es el nombre de la especie.
 * - VECES (una razón, p. ej. la contribución al riesgo sobre el peso) y PUNTOS (el HHI, 3 decimales): no negativas, con
 *   la presentación del análisis de /operar (`vecesEs`, `hhiEs`).
 */
export const UNIDADES = Object.freeze(["PESOS", "PESOS_POR_DOLAR", "PORCENTAJE", "DIAS", "MESES", "ESPECIES", "FECHA", "NOMBRE", "VECES", "PUNTOS"] as const);
export type Unidad = (typeof UNIDADES)[number];

type Digito = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
/** Id de un hecho: «H» y dos dígitos, de H01 a H99, consecutivo en el orden del paquete. */
export type IdHecho = Exclude<`H${Digito}${Digito}`, "H00">;
export const PATRON_ID_HECHO = /^H(?:0[1-9]|[1-9][0-9])$/;

/** ¿Es el texto un id de hecho (H01 a H99)? Lo usa, p. ej., quien lee las citas «{Hnn}» de la salida del modelo. */
export function esIdHecho(texto: string): texto is IdHecho {
  return PATRON_ID_HECHO.test(texto);
}

/** Día «AAAA-MM-DD» que existe en el calendario (lo valida `esDiaIso`). */
export type DiaIso = string;

export const MAX_HECHOS = 99;
export const MAX_LARGO_PRESENTACION = 64;
export const MAX_LARGO_FUENTE = 64;
export const MAX_LARGO_NOMBRE_ESPECIE = 48;
export const MAX_LARGO_DECIMAL = 40;
export const MAX_AVISOS = 32;
export const MAX_VERSIONES_CALCULO = 16;

/** Un dato ya calculado y presentado por 008. Lo arma `construirPaquete`: nunca a mano. */
export interface Hecho<C extends ClaveHecho = ClaveHecho> {
  readonly id: IdHecho;
  /** Clave del catálogo del tipo del paquete. */
  readonly clave: C;
  /**
   * Id de un hecho anterior al que se refiere: el «nombre de especie» (ESPECIE_NOMBRE) o, si este es un hecho de regla
   * (`CLAVES_DE_REGLA`), también el ancla de su regla (REGLA_DEL_PLAN), que a su vez cita a la especie. `especieDe`
   * (paquete.ts) resuelve los dos saltos.
   */
  readonly sujeto?: IdHecho;
  /** Decimal canónico en texto (con signo, sin exponente ni ceros sobrantes), día ISO o, con unidad NOMBRE, el nombre. */
  readonly valor: string;
  /** Del catálogo. */
  readonly unidad: Unidad;
  /** La cadena es-CO exacta que pinta la pantalla (`src/app/tablero/formato.ts`): la que pone el código en el texto. */
  readonly presentacion: string;
  /** Etiqueta genérica del catálogo: sin dígitos, cifras en palabras ni nombres de especie. */
  readonly etiqueta: string;
  readonly fuente: string;
  /** Día del dato; nunca posterior a `hoy`. */
  readonly fecha: DiaIso;
  readonly calidad: Calidad;
  readonly direccion: Direccion;
  readonly cercania: Cercania;
  readonly frescura: Frescura;
  /** Si el resumen tiene que citarlo. */
  readonly obligatorio: boolean;
  /** Solo en SIMULACION (`hechos-v2`): el código de rango del punto, de la lista cerrada de su clave en el catálogo. Sin dígitos. */
  readonly rango?: string;
  /** Solo en SIMULACION: la importancia del rango (la de `TRAMOS`). */
  readonly importancia?: Importancia;
}

/** Lo que entrega el armador por hecho: la etiqueta y la unidad las pone el catálogo. */
export type EntradaHecho<C extends ClaveHecho = ClaveHecho> = Omit<Hecho<C>, "etiqueta" | "unidad">;

/** El paquete completo, validado y congelado. Se guarda en el registro; al modelo solo va su vista ciega. */
export interface PaqueteHechos<T extends TipoResumen = TipoResumen> {
  readonly version: VersionHechos | VersionHechosV2;
  readonly tipo: T;
  readonly hoy: DiaIso;
  /** Versión de cada cálculo usado, p. ej. `{ conciliacion: "conciliacion-v3" }`. */
  readonly versionesCalculo: Readonly<Record<string, string>>;
  /** Códigos de aviso del cálculo (mayúsculas, dígitos y guion bajo). */
  readonly avisos: readonly string[];
  readonly hechos: readonly Hecho<ClaveDe<T>>[];
  /** sha256 en hexadecimal del JSON canónico del paquete sin este campo (`hashPaquete`). */
  readonly hash: string;
}

/** Lo que entrega el armador por paquete: la versión y el hash los pone `construirPaquete`. */
export interface EntradaPaquete<T extends TipoResumen = TipoResumen> {
  readonly tipo: T;
  readonly hoy: DiaIso;
  readonly versionesCalculo: Readonly<Record<string, string>>;
  readonly avisos: readonly string[];
  readonly hechos: readonly EntradaHecho<ClaveDe<T>>[];
}

/**
 * Los campos de un hecho que ve el modelo. Lista cerrada: cualquier otro campo en la vista es una fuga. `especie` no
 * está en el `Hecho`: la vista la deriva con `especieDe` (el id del nombre de la especie, ya resuelto) para que el
 * modelo no tenga que recorrer la cadena de `sujeto`. Es un id, nunca el nombre.
 */
export const CAMPOS_HECHO_CIEGO = Object.freeze(["id", "clave", "etiqueta", "sujeto", "especie", "direccion", "cercania", "frescura", "calidad", "obligatorio", "rango", "importancia"] as const);
/** Los campos de la vista: sin `version` (lleva un dígito), sin `hoy`, `avisos`, `versionesCalculo` ni `hash`. */
export const CAMPOS_PAQUETE_CIEGO = Object.freeze(["tipo", "hechos"] as const);

/** La versión del paquete de cada tipo: `hechos-v2` solo para SIMULACION. */
export const versionDeHechosDe = (tipo: TipoResumen): VersionHechos | VersionHechosV2 => (tipo === "SIMULACION" ? VERSION_HECHOS_V2 : VERSION_HECHOS);

/** Los campos ciegos que vienen del `Hecho` (todos menos `especie`, que deriva la vista). */
type CampoCiego = Exclude<(typeof CAMPOS_HECHO_CIEGO)[number], "especie">;
type CampoCiegoDelPaquete = (typeof CAMPOS_PAQUETE_CIEGO)[number];

/**
 * Un hecho tal como lo ve el modelo. Los demás campos del hecho quedan como `never`: un `Hecho` completo NO es
 * asignable a un `HechoCiego` (el compilador ve la fuga, no solo la guarda en ejecución).
 */
export type HechoCiego<C extends ClaveHecho = ClaveHecho> = Pick<Hecho<C>, CampoCiego>
  & { readonly especie?: IdHecho }
  & { readonly [K in Exclude<keyof Hecho, CampoCiego>]?: never };

/** Lo ÚNICO que recibe un modelo: ni valores, ni presentaciones, ni nombres, ni fechas, ni fuentes. */
export type PaqueteCiego<T extends TipoResumen = TipoResumen> = {
  readonly tipo: T;
  readonly hechos: readonly HechoCiego<ClaveDe<T>>[];
} & { readonly [K in Exclude<keyof PaqueteHechos, CampoCiegoDelPaquete>]?: never };

/** Un paquete de cualquier tipo que se estrecha al comprobar `tipo` (las claves quedan las de ese tipo). */
export type PaqueteDeAlgunTipo = { readonly [T in TipoResumen]: PaqueteHechos<T> }[TipoResumen];
