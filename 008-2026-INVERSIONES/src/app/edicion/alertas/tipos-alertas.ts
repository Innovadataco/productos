/** Lo que /edicion/alertas le pasa a su formulario y a sus secciones: solo texto y booleanos, ya formateado en el servidor. */
export interface ValoresAlertas {
  readonly alertaCercaPct: string;
  readonly alertaCercaActiva: boolean;
  readonly alertaNivelCruzadoActiva: boolean;
  readonly alertaMovimientoPct: string;
  readonly alertaMovimientoActiva: boolean;
  readonly alertaCaidaPct: string;
  readonly alertaCaidaActiva: boolean;
  readonly alertaDatoViejoMin: string;
  readonly alertaDatoViejoActiva: boolean;
  readonly alertaExDiasHabiles: string;
  readonly alertaExActiva: boolean;
}

export interface VersionUmbralVista {
  readonly version: number;
  /** «11-ene-2027 18:41», hora de Colombia. */
  readonly creada: string;
  readonly motivo: string;
  /** «Cerca 3,5 % · Movimiento 4 % (apagada) · …». */
  readonly resumen: string;
}

export interface DatosEdicionAlertas {
  /** La última versión guardada (0 si no hay): contra ella se crea la nueva. */
  readonly ultimaVersion: number;
  /** Sin versiones rigen las omisiones del motor. */
  readonly porOmision: boolean;
  /** Lo vigente (o la omisión): lo que el formulario trae precargado. */
  readonly valores: ValoresAlertas;
  readonly historia: readonly VersionUmbralVista[];
  /** La versión recién guardada (de ?guardada=N), si es una de la historia. */
  readonly guardada: number | null;
}
