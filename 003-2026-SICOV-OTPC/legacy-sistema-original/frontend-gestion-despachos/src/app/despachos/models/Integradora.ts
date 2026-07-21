export interface Persona {
  tipoDocumento: string;
  numeroIdentificacion: string;
  nombres: string;
  apellidos: string;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
}

export interface Licencia {
  numeroLicencia: string;
  estado: string;
  fechaVencimiento: string;
}

export interface Alcoholimetria {
  resultado: string;
  grado: string;
  fecha: string;
  hora: string;
  codigo: string;
}

export interface ExamenMedico {
  resultado: string;
  fecha: string;
  hora: string;
  codigo: string;
}

export interface AptitudFisica {
  resultado: string;
  fecha: string;
  hora: string;
  codigo: string;
}

export interface Conductor {
  persona: Persona;
  licencia: Licencia;
  alcoholimetria: Alcoholimetria;
  examenMedico: ExamenMedico;
  aptitudFisica: AptitudFisica;
}

export interface Vehiculo {
  placa: string;
  claseVehiculoCodigo: number;
  claseVehiculo: string;
  numeroSoat: string;
  soatVencimiento: string;
  numeroRtm: string;
  rtmVencimiento: string;
}

export interface Poliza {
  numeroPoliza: string;
  estado: string;
  vencimiento: string;
}

export interface Polizas {
  contractual: Poliza;
  extracontractual: Poliza;
}

export interface TarjetaOperacion {
  numero: string;
  estado: string;
  fechaExpedicion: string;
  vencimiento: string;
  empresaAsociada: string;
}

export interface Empresa {
  idEmpresa: string;
  nit: string;
  razonSocial: string;
}

export interface Mantenimiento {
  detalleActividades: string;
  fecha: string;
  id: string;
}

export interface RespuestaIntegradora {
  conductor1: Conductor;
  conductor2: Conductor;
  vehiculo: Vehiculo;
  polizas: Polizas;
  tarjetaOperacion: TarjetaOperacion;
  mantenimientoPreventivo: Mantenimiento;
  mantenimientoCorrectivo: Mantenimiento;
  alistamientoDiario: Mantenimiento;
  autorizaciones: any[]; // Puedes reemplazar 'any' por una interfaz si tienes la estructura
  empresa: Empresa;
}
