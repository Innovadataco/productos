/** Payload POST /api/v1/integracion/despachos */
export interface ObjDespachoIntegracion {
  nitEmpresaTransporte: string;
  razonSocial: string;
  sede: string;
  numeroPasajero: string;
  valorTiquete: string;
  valorTotalTasaUso: string;
  valorPruebaAlcoholimetria: string;
  tipoDespacho: string;
  observaciones: string;
  fechaSalida: string;
  horaSalida: string;
  despachoEnTransito: boolean;
}

export interface ObjVehiculoIntegracion {
  placa: string;
  soat: string;
  fechaVencimientoSoat: string;
  revisionTecnicoMecanica: string;
  fechaRevisionTecnicoMecanica: string;
  idPolizaContractual: string;
  idPolizaExtracontractual: string;
  vigenciaContractual: string;
  estadoContractual: string;
  vigenciaExtracontractual: string;
  estadoExtracontractual: string;
  tarjetaOperacion: string;
  fechaTarjetaOperacion: string;
  fechaVencimientoTarjetaOperacion: string;
  estadoTarjetaOperacion: string;
  idMatenimientoPreventivo: string;
  observacionMatenimientoPreventivo: string;
  fechaMantenimientoPreventivo: string;
  idMatenimientocorrectivo: number;
  observacionMatenimientocorrectivo: string;
  fechaMantenimientocorrectivo: string;
  idProtocoloAlistamientodiario: string;
  fechaProtocoloAlistamientodiario: string;
  observacionProtocoloAlistamientodiario: string;
  observaciones: string;
  clase: string;
  nivelServicio: string;
}

export interface ObjConductoresIntegracion {
  tipoIdentificacionPrincipal: string;
  numeroIdentificacion: string;
  primerNombrePrincipal: string;
  segundoNombrePrincipal: string;
  primerApellidoPrincipal: string;
  segundoApellidoPrincipal: string;
  idExamenMedico: string;
  licenciaConduccion: string;
  fechaVencimientoLicencia: string;
  idPruebaAlcoholimetria: string;
  tipoIdentificacionSecundario: string;
  numeroIdentificacionSecundario: string;
  primerNombreSecundario: string;
  segundoNombreSecundario: string;
  primerApellidoSecundario: string;
  segundoApellidoSecundario: string;
  idPruebaAlcoholimetriaSecundario: string;
  licenciaConduccionSecundario: string;
  idExamenMedicoSecundario: string;
  fechaVencimientoLicenciaSecundario: string;
}

export interface ObjRutasIntegracion {
  idRutaAutorizada: string;
  idOrigen: string;
  detalleOrigen: string;
  idDestino: string;
  detalleDestino: string;
  via: string;
  centroPobladoOrigen: string;
  centroPobladoDestino: string;
}

export interface RegistroDespachoIntegracion {
  obj_despacho: ObjDespachoIntegracion;
  obj_vehiculo: ObjVehiculoIntegracion;
  obj_conductores: ObjConductoresIntegracion;
  obj_rutas: ObjRutasIntegracion;
  array_autorizaciones?: Record<string, unknown>[];
}

export interface ConsultaIntegradoraBody {
  numeroIdentificacion1: string;
  numeroIdentificacion2?: string;
  placa: string;
  nit?: string;
  fechaConsulta: string;
  horaConsulta?: string;
}

export interface RegistroLlegadaIntegracion {
  idTipollegada: string;
  nitEmpresaTransporte: string;
  idDespacho?: string | null;
  terminalLlegada: string;
  numeroPasajero: string;
  horaLlegada: string;
  fechaLlegada: string;
  placa: string;
  sede: string;
}
