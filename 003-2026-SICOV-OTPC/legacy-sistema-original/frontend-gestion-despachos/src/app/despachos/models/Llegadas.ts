export interface RegistroConductorLlegada {
  idLlegada?: string;
  tipoIdentificacionConductor?: string;
  numeroIdentificacion?: string;
  primerNombreConductor?: string;
  segundoNombreConductor?: string | null;
  primerApellidoConductor?: string;
  segundoApellidoConductor?: string | null;
  idPruebaAlcoholimetria?: string;
  resultadoPruebaAlcoholimetria?: string;
  fechaUltimaPruebaAlcoholimetria?: string;
  licenciaConduccion?: string;
  fechaVencimientoLicencia?: string;
  idExamenMedico?: string;
  fechaUltimoExamenMedico?: string;
  observaciones?: string;
}
export interface Llegadas {
  id?: string;
  idTipollegada?: number;
  idDespacho?: number | null;
  terminalLlegada?: string;
  horaLlegada?: string;
  fechaLlegada?: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  estado?: boolean;
  numeroPasajero?: number | null;
  nitEmpresaTransporte?: string;
  fuenteDato?: string;
  placa?: string;
  nitTerminal?: string;
}

export interface Llegada {
  id?: string;
  idTipollegada?: number;
  nitEmpresaTransporte?: string;
  idDespacho?: number | null;
  terminalLlegada?: string;
  numeroPasajero?: number | null;
  horaLlegada?: string;
  fechaLlegada?: string;
  idDespachoTerminal?: number;
  terminalDespacho?: string;
  editar?: boolean;
  placa?: string;
  sede?: string;
}

export interface VehiculoSalida {
  id?: number;
  idDespachos?: number;
  placa?: string;
  soat?: string;
  fechaVencimientoSoat?: string;
  revisionTecnicoMecanica?: string;
  fechaRevisionTecnicoMecanica?: string;
  tarjetaOperacion?: string;
  fechaVencimientoTarjetaOperacion?: string;
  idMatenimientoPreventivo?: string;
  fechaMantenimientoPreventivo?: string;
  idProtocoloAlistamientodiario?: string;
  fechaProtocoloAlistamientodiario?: string;
  observaciones?: string;
  clase?: number;
  nivelServicio?: number;
  idPolizaContractual?: string;
  idPolizaExtracontractual?: string;
  vigenciaContractual?: string;
  vigenciaExtracontractual?: string;
}

export interface ConductorSalida {
  id?: number;
  idDespacho?: number;
  tipoIdentificacionConductorPrincipal?: string;
  numeroIdentificacion?: string;
  primerNombreConductorPrincipal?: string;
  segundoNombreConductorPrincipal?: string | null;
  primerApellidoConductorPrincipal?: string;
  segundoApellidoConductorPrincipal?: string;
  tipoIdentificacionConductorSecundario?: string;
  numeroIdentificacionConductorSecundario?: string;
  primerNombreConductorSecundario?: string;
  segundoNombreConductorSecundario?: string | null;
  primerApellidoConductorSecundario?: string;
  segundoApellidoConductorSecundario?: string;
  idPruebaAlcoholimetria?: string;
  resultadoPruebaAlcoholimetria?: string;
  fechaUltimaPruebaAlcoholimetria?: string;
  licenciaConduccion?: string;
  fechaVencimientoLicencia?: string;
  idExamenMedico?: string;
  fechaUltimoExamenMedico?: string;
  observaciones?: string;
  idPruebaAlcoholimetriaSecundario?: string;
  resultadoPruebaAlcoholimetriaSecundario?: string;
  fechaUltimaPruebaAlcoholimetriaSecundario?: string;
  licenciaConduccionSecundario?: string;
  fechaVencimientoLicenciaSecundario?: string;
  idExamenMedicoSecundario?: string;
  fechaUltimoExamenMedicoSecundario?: string;
  observacionesSecundario?: string;
}

export interface NovedadSalida {
  id?: number;
  id_despacho?: number;
  descripcion?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string | null;
  otros?: string;
  tipo_novedad_id?: number;
  novedades_vehiculos?: any[];
  novedades_conductores?: any[];
}

export interface SalidaConsultada {
  id?: number;
  id_despacho_terminal?: string;
  terminal_despacho?: string;
  nit_empresa_transporte?: string;
  razon_social?: string;
  numero_pasajero?: number;
  valor_tiquete?: string;
  valor_total_tasa_uso?: string;
  valor_prueba_alcoholimetria?: string;
  tipo_despacho?: string | null;
  observaciones?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  ruta?: any;
  vehiculo?: VehiculoSalida;
  conductor?: ConductorSalida;
  autorizacion?: any;
  llegadas?: any[];
  novedades?: NovedadSalida[];
}

export interface RegistroVehiculoLlegada {
  llegada_id?: number | string;
  placa?: string;
  soat?: string;
  fechavencimientoSoat?: string;
  revisiontecnicomecanica?: string;
  fecharevisiontecnicomecanica?: string;
  id_poliza_contractual?: string;
  id_poliza_extracontractual?: string;
  tipopoliza?: string;
  vigenciacontractual?: string;
  vigenciaextracontractual?: string;
  tarjetaoperacion?: string;
  fechavencimientoTarjetaOperacion?: string;
  idMatenimientopreventivo?: string;
  fechaMantenimientopreventivo?: string;
  idprotocoloalistamientodiario?: string;
  fechaprotocoloalistamientodiario?: string;
  observaciones?: string;
  clase?: number | string;
  nivelservicio?: number;
}
