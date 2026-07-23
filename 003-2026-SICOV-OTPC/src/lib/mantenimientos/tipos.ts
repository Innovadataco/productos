/// Tipos y constantes de dominio del módulo Mantenimientos (spec 005-A).

/// Tipos operables en 005: 1=Preventivo, 2=Correctivo. Alistamiento(3)/Autorización(4) → 006/007.
export const TIPOS_OPERABLES = [1, 2] as const;
export type TipoOperable = (typeof TIPOS_OPERABLES)[number];

export const NOMBRE_TIPO: Record<number, string> = { 1: "preventivo", 2: "correctivo" };

/// Placa: 3 letras + 3 dígitos (manual §10.7).
export const REGEX_PLACA = /^[A-Z]{3}[0-9]{3}$/;

/// Hora de pared HH:mm — validación de borde vinculante (gate D-022 #3).
export const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/// Catálogo de tipos de identificación (D-022 #5 — manual de usuario). Constante, NO tabla.
export const TIPOS_IDENTIFICACION: ReadonlyArray<{ codigo: number; descripcion: string }> = [
  { codigo: 1, descripcion: "Cédula de ciudadanía" },
  { codigo: 2, descripcion: "Cédula de extranjería" },
  { codigo: 3, descripcion: "Pasaporte" },
  { codigo: 4, descripcion: "Cédula de ciudadanía digital" },
  { codigo: 5, descripcion: "Tarjeta de identidad" },
  { codigo: 6, descripcion: "Registro civil" },
  { codigo: 7, descripcion: "PEP" },
  { codigo: 8, descripcion: "DIE" },
  { codigo: 9, descripcion: "NIT" },
  { codigo: 10, descripcion: "NN" },
  { codigo: 11, descripcion: "Carnet Diplomático" },
  { codigo: 12, descripcion: "Permiso por Protección Temporal" },
];

export function esTipoIdentificacionValido(v: unknown): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= TIPOS_IDENTIFICACION.length;
}

/// Registro de detalle preventivo/correctivo (mismas 10 columnas del manual §10.10).
export interface RegistroDetalle {
  vigiladoId?: string | number;
  placa: string;
  fecha: string; // AAAA-MM-DD
  hora: string; // HH:mm
  nit: string | number;
  razonSocial: string;
  tipoIdentificacion: string | number;
  numeroIdentificacion: string;
  nombresResponsable: string;
  detalleActividades: string;
}

/// Resumen de carga masiva (paridad legacy: {total, exitosos, errores[]}).
export interface ResumenCarga {
  total: number;
  exitosos: number;
  errores: string[];
}

/// Tipos de job de la cola (005 procesa los 3 primeros; el resto llega en 006/007).
export const TIPOS_JOB = ["base", "preventivo", "correctivo", "alistamiento", "autorizacion"] as const;
export type TipoJob = (typeof TIPOS_JOB)[number];
export const TIPOS_JOB_PROCESABLES: ReadonlyArray<TipoJob> = ["base", "preventivo", "correctivo"];
