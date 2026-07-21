export interface Novedad {
  id?: number;
  idDespacho?: number; // Unique identifier for the event
  idTipoNovedad?: number | string; // Identifier for the type of event
  fechaNovedad?: string; // Date of the event
  horaNovedad?: string; // Time of the event
  descripcion?: string; // Description of the event
  otros: string; // Additional information about the event
}

export interface Persona {
  primerNombre?: string;
  segundoNombre?: string;
  primerApellido?: string;
  segundoApellido?: string;
  numeroIdentificacion?: string;
  tipoDocumento?: string;
  nombres?: string;
  apellidos?: string;
}

export interface Licencia {
  numeroLicencia?: string;
  fechaVencimiento?: string;
  estado?: string;
}

export interface Alcoholimetria {
  resultado?: string;
  fecha?: string;
  hora?: string;
  codigo?: number;
}

export interface ExamenMedico {
  resultado?: string;
  fecha?: string;
  hora?: string;
  codigo?: number;
}

export interface AptitudFisica {
  resultado?: string;
  fecha?: string;
  hora?: string;
  codigo?: number;
}

export interface Conductor {
  persona?: Persona;
  licencia?: Licencia;
  alcoholimetria?: Alcoholimetria;
  examenMedico?: ExamenMedico;
  aptitudFisica?: AptitudFisica;
}

export interface Vehiculo {
  numeroSoat?: string;
  revisionTecnicoMecanica?: string;
  placa?: string;
  soat_vencimiento?: string;
  fechaRevisionTecnicoMecanica?: string;
  tarjetaOperacion?: TarjetaOperaciones;
  mantenimiento?: Mantenimiento;
  polizas?: Polizas;
  alistamientoDiario?: Alistamiento_diario;
  claseVehiculoCodigo?: string;
  claseVehiculo?: string;
}

export interface TarjetaOperaciones {
  numero?: string;
  estado?: string;
  fechaExpedicion?: string;
  vencimiento?: string;
  empresaAsociada?: string;
}

export interface Mantenimiento {
  id?: number;
  fecha?: string;
  detalleActividades?: string;
}

export interface Polizas {
  contractual?: Tipo_poliza;
  extracontractual?: Tipo_poliza;
}

export interface Tipo_poliza {
  estado?: string;
  numeroPoliza?: string | number;
  vencimiento?: string;
}

export interface Alistamiento_diario {
  id?: number;
  fecha?: string;
  detalleActividades?: string;
}

export interface NovedadListada {
  id?: number;
  idDespacho?: number;
  descripcion?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string | null;
  otros?: string;
  idTipoNovedad?: number | string;
  novedades_vehiculos?: NovedadVehiculo[];
  novedades_conductores?: NovedadConductor[];
  novedadesConductores?: NovedadConductor[];
  novedadesVehiculos?: NovedadVehiculo[];
}

export interface NovedadVehiculo {
  id?: number;
  idNovedad?: number;
  placa?: string;
  soat?: string;
  fechaVencimientoSoat?: string;
  revisionTecnicoMecanica?: string;
  fechaRevisionTecnicoMecanica?: string;
  tarjetaOperacion?: string;
  fechaVencimientoTarjetaOperacion?: string;
  idMatenimientoPreventivo?: string | number;
  fechaMantenimientoPreventivo?: string;
  idProtocoloAlistamientodiario?: string | number;
  fechaProtocoloAlistamientodiario?: string;
  observaciones?: string;
  clase?: number;
  nivelServicio?: number;
  fechaCreacion?: string;
  fechaActualizacion?: string | null;
  estado?: boolean;
  idPolizaContractual?: string | number;
  idPolizaExtracontractual?: string | number;
  vigenciaContractual?: string;
  vigenciaExtracontractual?: string;
}

export interface NovedadConductor {
  id?: number;
  idNovedad?: number;
  tipoIdentificacionConductor?: string | number;
  numeroIdentificacion?: string;
  primerNombreConductor?: string;
  segundoNombreConductor?: string | null;
  primerApellidoConductor?: string;
  segundoApellidoConductor?: string | null;
  idPruebaAlcoholimetria?: string | number;
  resultadoPruebaAlcoholimetria?: string;
  fechaUltimaPruebaAlcoholimetria?: string;
  licenciaConduccion?: string;
  idExamenMedico?: string | number;
  fechaUltimoExamenMedico?: string;
  observaciones?: string;
  fechaCreacion?: string;
  fechaActualizacion?: string | null;
  estado?: boolean;
  fechaVencimientoLicencia?: string;
}
