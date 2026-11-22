/**
 * Lo que /edicion/ia (E8) le pasa a sus componentes: ya serializado (texto, números y booleanos; sin BigInt ni fechas),
 * como lo escribe el dueño. Solo tipos: lo importan el servidor y los componentes de cliente.
 */
export interface Opcion {
  readonly valor: string;
  readonly texto: string;
}

export interface OpcionModeloNube extends Opcion {
  /** «USD 4 y USD 20 por millón de tokens» (de la skill: por verificar antes de encender). */
  readonly precio: string;
}

/** Un modelo de la lista que publica PI. */
export interface OpcionModeloLocal {
  readonly nombre: string;
  readonly nota: string | null;
  readonly recomendado: boolean;
  /** Un 32B: «recarga unos 20 GB en frío en cada corrida». */
  readonly aviso32b: boolean;
}

export interface TareaEditable {
  readonly activo: boolean;
  /** Vacío: sin modelo. */
  readonly modeloLocal: string;
}

/** Lo que el dueño ve y escribe en el formulario (todo en texto, como en la ficha). */
export interface ConfigEditable {
  readonly modo: string;
  readonly ollamaHost: string;
  readonly ollamaPuerto: string;
  /** «0», «0,37», «1». */
  readonly temperatura: string;
  readonly tareas: Readonly<Record<string, TareaEditable>>;
  readonly modeloNube: string;
  readonly esfuerzoNube: string;
  /** «4,61» o vacío. */
  readonly topeMensualUsd: string;
  readonly horaResumen: string;
  readonly limiteSegundos: string;
}

export interface RequisitoVista {
  readonly clave: string;
  readonly estado: "LISTO" | "FALTA" | "POR_VERIFICAR";
  readonly detalle: string;
}

export interface EstadoPuertaVista {
  readonly puerta: "local" | "nube";
  readonly enUso: boolean;
  readonly estado: "LISTO" | "FALTA" | "POR_VERIFICAR";
  readonly requisitos: readonly RequisitoVista[];
}

export type GastoVista =
  | { readonly estado: "LEIDO"; readonly mes: string; readonly usado: string; readonly tope: string | null; readonly corridas: number }
  | { readonly estado: "NO_VERIFICABLE" };

export interface VersionVista {
  readonly version: number;
  readonly modo: string;
  readonly motivo: string;
  readonly autor: string;
  readonly fecha: string;
}

export interface DatosEdicionIa {
  /** La última versión cargada (contra ella se crea la nueva); 0 si todavía no hay ninguna. */
  readonly versionBase: number;
  readonly vigente: { readonly version: number; readonly desde: string } | null;
  readonly inicial: ConfigEditable;
  /** Lo guardado que el formulario necesita saber: si hay destino (para identificar y probar) y el modelo de cada tarea. */
  readonly guardado: { readonly hayDestino: boolean; readonly modelos: Readonly<Record<string, string>> };
  readonly opciones: {
    readonly modos: readonly Opcion[];
    readonly modelosNube: readonly OpcionModeloNube[];
    readonly esfuerzos: readonly Opcion[];
    readonly horas: readonly string[];
    readonly tareas: readonly Opcion[];
    readonly modelosLocales: readonly OpcionModeloLocal[];
    readonly limites: { readonly limiteMin: number; readonly limiteMax: number; readonly topeMin: string; readonly topeMax: string };
  };
  readonly listaPi: { readonly estado: "LISTA" | "SIN_LISTA"; readonly detalle: string; readonly publicadoPor: string | null; readonly fecha: string | null };
  readonly puertas: readonly EstadoPuertaVista[];
  readonly gasto: GastoVista;
  /** Solo sí o no: la llave nunca se lee más allá de saber que no está vacía. */
  readonly llaveCargada: boolean;
  readonly sonda: "PENDIENTE" | "DIRECTA" | "SERVICIO";
  readonly historia: readonly VersionVista[];
  /** La versión que se acaba de guardar (de ?guardada), si existe. */
  readonly guardada: number | null;
}

/** Un modelo que devolvió «Identificar modelos» (la forma de la respuesta de /api/ia/ollama). */
export interface ModeloIdentificadoVista {
  readonly nombre: string;
  readonly tamanoBytes: number | null;
  readonly digest: string | null;
  readonly enLista: boolean;
  readonly digestCoincide: boolean | null;
  readonly seleccionable: boolean;
  readonly nota: string | null;
}

export interface PruebaVista {
  readonly modelo: string;
  readonly ok: boolean;
  readonly latenciaMs: number;
  readonly etapa: string | null;
  readonly detalle: string | null;
  readonly inalcanzable: boolean;
}

/** Un error de un campo, como lo devuelve la ruta (solo campo y código). */
export interface CampoConErrorIa {
  readonly campo: string;
  readonly codigo: string;
}
