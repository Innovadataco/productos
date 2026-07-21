export interface HistorialPreventivo {
  id: number;
  placa: string;
  fecha: string; // ISO date string
  hora: string;
  nit: number;
  razon_social: string;
  tipo_identificacion: number;
  numero_identificacion: number;
  nombres_responsable: string;
  mantenimiento_id: number;
  detalle_actividades: string;
  estado: boolean;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface HistorialCorrectivo {
  id: number;
  placa: string;
  fecha: string; // ISO date string
  hora: string;
  nit: number;
  razon_social: string;
  tipo_identificacion: number;
  numero_identificacion: number;
  nombres_responsable: string;
  mantenimiento_id: number;
  detalle_actividades: string;
  estado: boolean;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface HistorialAlistamiento {
  id?: string;
  placa?: string;
  tipo_identificacion_responsable?: number;
  numero_identificacion_responsable?: number;
  nombre_responsable?: string;
  tipo_identificacion_conductor?: number;
  numero_identificacion_conductor?: number;
  nombres_conductor?: string;
  mantenimiento_id: number;
  estado: boolean;
  estadoMantenimiento?: boolean;
  detalle_actividades?: string;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface HistorialAutorizacion {
  id?: number;
  placa?: string;
  fecha_viaje?: Date; // ISO date string
  origen?: string;
  destino?: string;
  tipo_identificacion_nna?: number;
  numero_identificacion_nna?: string;
  nombres_apellidos_nna?: string;
  situacion_discapacidad?: string;
  tipo_discapacidad?: number;
  pertenece_comunidad_etnica?: string;
  tipo_poblacion_etnica?: number;
  tipo_identificacion_otorgante?: number;
  numero_identificacion_otorgante?: string;
  nombres_apellidos_otorgante?: string;
  numero_telefonico_otorgante?: string;
  correo_electronico_otorgante?: string;
  direccion_fisica_otorgante?: string;
  sexo_otorgante?: number;
  genero_otorgante?: number;
  calidad_actua?: number;
  tipo_identificacion_autorizado_viajar?: number;
  numero_identificacion_autorizado_viajar?: string;
  nombres_apellidos_autorizado_viajar?: string;
  numero_telefonico_autorizado_viajar?: string;
  direccion_fisica_autorizado_viajar?: string;
  tipo_identificacion_autorizado_recoger?: number;
  numero_identificacion_autorizado_recoger?: string;
  nombres_apellidos_autorizado_recoger?: string;
  numero_telefonico_autorizado_recoger?: string;
  direccion_fisica_autorizado_recoger?: string;
  copia_autorizacion_viaje_nombre_original?: string;
  copia_autorizacion_viaje_documento?: string;
  copia_autorizacion_viaje_ruta?: string;
  copia_documento_parentesco_nombre_original?: string;
  copia_documento_parentesco_documento?: string;
  copia_documento_parentesco_ruta?: string;
  copia_documento_identidad_autorizado_nombre_original?: string;
  copia_documento_identidad_autorizado_documento?: string;
  copia_documento_identidad_autorizado_ruta?: string;
  copia_constancia_entrega_nombre_original?: string;
  copia_constancia_entrega_documento?: string;
  copia_constancia_entrega_ruta?: string;
  mantenimiento_id?: number;
  estado?: boolean;
  estadoMantenimiento?: boolean;
}


