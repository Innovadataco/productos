export interface RegistroMantenimiento {
    id?: string
    fechaDiligenciamiento?: string;
    placa?: string;
    estadoMantenimiento?: string;
    tipoId?: string;
}

export interface MantenimientoPreventivo {
    id?: string;
    placa?: string;
    fecha?: string;
    hora?: string;
    nit?: number;
    razonSocial?: string;
    tipoIdentificacion?: string;
    numeroIdentificacion?: number;
    nombreIngeniero?: string;
    detalleActividades?: string;
}

export interface MantenimientoCorrectivo {
  id?: string;
  placa?: string;
  fecha?: string;
  hora?: string;
  nit?: number;
  razonSocial?: string;
  tipoIdentificacion?: string;
  numeroIdentificacion?: number;
  nombreIngeniero?: string;
  detalleActividades?: string;
}
