/** Lo que /edicion/tarifas (O5) le pasa a su formulario y a sus secciones: solo texto, ya formateado en el servidor. */
export interface TarifaResumida {
  readonly version: number;
  readonly desde: string;
  /** «0,2731 % del valor (mínimo $ 7,13) · fijo $ 0 · IVA 17,31 % sobre la comisión · sin otros cargos». */
  readonly detalle: string;
}

export interface TarifaVista extends TarifaResumida {
  readonly comisionista: string;
  readonly lado: string;
  readonly motivo: string;
  readonly creada: string;
}

export interface VigenteVista {
  readonly comisionista: string;
  readonly lado: string;
  /** null si ese comisionista y lado no tienen tarifa vigente hoy. */
  readonly tarifa: TarifaResumida | null;
  /** «La tarifa explica 37 de 41 órdenes de compra pasadas…» o por qué no se contrasta. */
  readonly control: string;
}

export interface Opcion {
  readonly valor: string;
  readonly texto: string;
}

export interface DatosEdicionTarifas {
  /** La última versión guardada (0 si no hay): contra ella se crea la nueva. */
  readonly ultimaVersion: number;
  readonly hoy: string;
  readonly vigentes: readonly VigenteVista[];
  readonly historia: readonly TarifaVista[];
  readonly comisionistas: readonly Opcion[];
  readonly lados: readonly Opcion[];
  readonly tiposCargo: readonly Opcion[];
  readonly maxCargos: number;
  /** La versión recién guardada (de ?guardada=N), si es una de la historia. */
  readonly guardada: number | null;
}
