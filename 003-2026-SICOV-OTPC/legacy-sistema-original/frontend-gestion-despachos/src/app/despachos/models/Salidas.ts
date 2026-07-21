export interface Salidas {
  id?: number;
  // idDespachoTerminal?: number;
  nitEmpresaTransporte?: string;
  razonSocial?: string;
  // terminalDespacho?: string;
  // sede?: string;
  tipoDespacho?: number;
  numeroPasajero?: number;
  valorTiquete?: string;
  valorTotalTasaUso?: string;
  observaciones?: string;
  estado?: boolean;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  fuenteDato?: string;
  fechaSalida?: string;
  horaSalida?: string;
}

export interface Integradora {
  numeroIdentificacion1?: string;
  numeroIdentificacion2?: string;
  placa?: string;
  nit?: string;
  fechaConsulta?: string;
  horaConsulta?: string;
}

export interface RegistrarAutorizaciones {
  idDespacho: number,
  autorizacion:any []
}

export interface RegistrarRutas {
  idDespacho: number,
  idRutaAutorizada: string;
  idOrigen: string;
  detalleOrigen: string;
  idDestino: string;
  detalleDestino: string;
  via: string;
  centroPobladoOrigen: string;
  centroPobladoDestino: string;
  observaciones: string;
}

export interface RegistrarConductores {
  idDespacho: number,
  tipoIdentificacionPrincipal: number | null;
  numeroIdentificacion: string;
  primerNombrePrincipal: string;
  segundoNombrePrincipal: string;
  primerApellidoPrincipal: string;
  segundoApellidoPrincipal: string;
  tipoIdentificacionSecundario: number | null;
  numeroIdentificacionSecundario: string;
  primerNombreSecundario: string;
  segundoNombreSecundario: string;
  primerApellidoSecundario: string;
  segundoApellidoSecundario: string;
  idPruebaAlcoholimetria: string;
  idExamenMedico: string;
  licenciaConduccion: string;
  fechaVencimientoLicencia: string;
  idPruebaAlcoholimetriaSecundario: string;
  licenciaConduccionSecundario: string;
  fechaVencimientoLicenciaSecundario: string;
  idExamenMedicoSecundario: string;
}

export interface RegistrarVehiculos {
  idDespachos: number,
  placa: string;
  soat: string;
  fechaVencimientoSoat: string;
  revisionTecnicoMecanica: string;
  fechaRevisionTecnicoMecanica: string;
  idPolizasContractual?: string;
  idPolizasExtracontractual?: string;
  vigenciaContractual?: string;
  vigenciaExtracontractual?: string;
  tarjetaOperacion: string;
  fechaTarjetaOperacion: string;
  idMatenimientoPreventivo?: string;
  fechaMantenimiento?: string;
  idProtocoloAlistamientodiario?: string;
  fechaProtocoloAlistamientodiario?: string;
  observaciones: string;
  clase: number | null;
  nivelServicio: number | null;
}
