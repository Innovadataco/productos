/** Lo que /edicion/tarifas (O5) le pasa a su formulario y a sus secciones: solo texto, ya formateado en el servidor. */
export interface TarifaVista {
  readonly version: number;
  readonly comisionista: string;
  readonly lado: string;
  readonly desde: string;
  /** «0,25 % del valor (mínimo $ 4.613) · fijo $ 0 · IVA 19 % sobre la comisión · Bolsa: 0,03 % del valor». */
  readonly detalle: string;
  readonly motivo: string;
  readonly creada: string;
}

export interface VigenteVista {
  readonly comisionista: string;
  readonly lado: string;
  /** null si ese comisionista y lado no tienen tarifa vigente hoy. */
  readonly tarifa: TarifaVista | null;
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
