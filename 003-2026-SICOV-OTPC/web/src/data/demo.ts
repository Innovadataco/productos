// Datos demo del dominio Gesmovil / sicov.
// Reemplazables por la API real (NestJS) sin tocar la UI.

export type EstadoCola = 'pendiente' | 'procesando' | 'procesado' | 'fallido'

export interface Despacho {
  id: string
  placa: string
  empresa: string
  nit: string
  ruta: string
  origen: string
  destino: string
  fechaHora: string
  estado: EstadoCola
  reintentos: number
  respuesta?: string
}

export interface Llegada {
  id: string
  placa: string
  empresa: string
  nit: string
  tipoLlegada: string
  terminal: string
  fechaHora: string
  estado: EstadoCola
  reintentos: number
}

export type TipoMant = 'Preventivo' | 'Correctivo' | 'Alistamiento' | 'Autorización'
export interface Mantenimiento {
  id: string
  placa: string
  empresa: string
  tipo: TipoMant
  descripcion: string
  fecha: string
  responsable: string
  estado: 'registrado' | 'en_cola' | 'enviado' | 'fallido'
}

export type CategoriaNovedad = 'Vehículo' | 'Conductor'
export interface Novedad {
  id: string
  categoria: CategoriaNovedad
  placa: string
  detalle: string
  documento: string
  vence: string
  severidad: 'ok' | 'porVencer' | 'vencido'
}

export interface Soporte {
  id: string
  asunto: string
  motivo: string
  empresa: string
  creado: string
  estado: 'abierto' | 'respondido' | 'cerrado'
  adjuntos: number
}

export const empresas = [
  { nit: '900853057', nombre: 'Transportes Andinos S.A.' },
  { nit: '830001234', nombre: 'Flota La Macarena Ltda.' },
  { nit: '860500999', nombre: 'Rápido Tolima S.A.' },
  { nit: '891800456', nombre: 'Coomotor Cooperativa' },
  { nit: '900112233', nombre: 'Expreso Bolivariano' },
]

const placas = ['SVL482', 'TQK109', 'WBR774', 'XZC031', 'UHM560', 'PKD298', 'RTN845', 'YFG612']
const rutas = ['Bogotá – Ibagué', 'Cali – Popayán', 'Medellín – Montería', 'Bucaramanga – Cúcuta', 'Neiva – Bogotá']

export const despachos: Despacho[] = [
  { id: 'DSP-24817', placa: 'SVL482', empresa: 'Transportes Andinos S.A.', nit: '900853057', ruta: rutas[0], origen: 'Terminal Salitre', destino: 'Terminal Ibagué', fechaHora: '2026-07-21 06:15', estado: 'procesado', reintentos: 0, respuesta: 'OK · radicado 8841200' },
  { id: 'DSP-24818', placa: 'TQK109', empresa: 'Flota La Macarena Ltda.', nit: '830001234', ruta: rutas[4], origen: 'Terminal Neiva', destino: 'Terminal Salitre', fechaHora: '2026-07-21 06:40', estado: 'procesando', reintentos: 1 },
  { id: 'DSP-24819', placa: 'WBR774', empresa: 'Rápido Tolima S.A.', nit: '860500999', ruta: rutas[0], origen: 'Terminal Ibagué', destino: 'Terminal Salitre', fechaHora: '2026-07-21 07:05', estado: 'pendiente', reintentos: 0 },
  { id: 'DSP-24820', placa: 'XZC031', empresa: 'Coomotor Cooperativa', nit: '891800456', ruta: rutas[1], origen: 'Terminal Cali', destino: 'Terminal Popayán', fechaHora: '2026-07-21 07:20', estado: 'fallido', reintentos: 3, respuesta: 'Error 422 · placa no vigente' },
  { id: 'DSP-24821', placa: 'UHM560', empresa: 'Expreso Bolivariano', nit: '900112233', ruta: rutas[3], origen: 'Terminal Bucaramanga', destino: 'Terminal Cúcuta', fechaHora: '2026-07-21 07:45', estado: 'procesado', reintentos: 0, respuesta: 'OK · radicado 8841233' },
  { id: 'DSP-24822', placa: 'PKD298', empresa: 'Transportes Andinos S.A.', nit: '900853057', ruta: rutas[2], origen: 'Terminal Medellín', destino: 'Terminal Montería', fechaHora: '2026-07-21 08:10', estado: 'pendiente', reintentos: 0 },
]

export const llegadas: Llegada[] = [
  { id: 'LLG-19004', placa: 'SVL482', empresa: 'Transportes Andinos S.A.', nit: '900853057', tipoLlegada: 'Programada', terminal: 'Terminal Ibagué', fechaHora: '2026-07-21 11:02', estado: 'procesado', reintentos: 0 },
  { id: 'LLG-19005', placa: 'UHM560', empresa: 'Expreso Bolivariano', nit: '900112233', tipoLlegada: 'Programada', terminal: 'Terminal Cúcuta', fechaHora: '2026-07-21 12:35', estado: 'procesando', reintentos: 1 },
  { id: 'LLG-19006', placa: 'YFG612', empresa: 'Flota La Macarena Ltda.', nit: '830001234', tipoLlegada: 'No programada', terminal: 'Terminal Salitre', fechaHora: '2026-07-21 12:50', estado: 'pendiente', reintentos: 0 },
  { id: 'LLG-19007', placa: 'RTN845', empresa: 'Rápido Tolima S.A.', nit: '860500999', tipoLlegada: 'Programada', terminal: 'Terminal Salitre', fechaHora: '2026-07-21 13:15', estado: 'fallido', reintentos: 2 },
]

export const mantenimientos: Mantenimiento[] = [
  { id: 'MNT-7712', placa: 'SVL482', empresa: 'Transportes Andinos S.A.', tipo: 'Preventivo', descripcion: 'Cambio aceite y filtros — 40.000 km', fecha: '2026-07-19', responsable: 'C. Rodríguez', estado: 'enviado' },
  { id: 'MNT-7713', placa: 'TQK109', empresa: 'Flota La Macarena Ltda.', tipo: 'Correctivo', descripcion: 'Reemplazo pastillas de freno', fecha: '2026-07-20', responsable: 'J. Pérez', estado: 'en_cola' },
  { id: 'MNT-7714', placa: 'WBR774', empresa: 'Rápido Tolima S.A.', tipo: 'Alistamiento', descripcion: 'Alistamiento diario — checklist 32 ítems', fecha: '2026-07-21', responsable: 'M. Gómez', estado: 'registrado' },
  { id: 'MNT-7715', placa: 'XZC031', empresa: 'Coomotor Cooperativa', tipo: 'Autorización', descripcion: 'Autorización salida ruta especial', fecha: '2026-07-21', responsable: 'A. Salazar', estado: 'fallido' },
  { id: 'MNT-7716', placa: 'UHM560', empresa: 'Expreso Bolivariano', tipo: 'Preventivo', descripcion: 'Revisión sistema de suspensión', fecha: '2026-07-18', responsable: 'C. Rodríguez', estado: 'enviado' },
]

export const novedades: Novedad[] = [
  { id: 'NV-501', categoria: 'Vehículo', placa: 'SVL482', detalle: 'SOAT', documento: 'SOAT-2026', vence: '2026-08-02', severidad: 'porVencer' },
  { id: 'NV-502', categoria: 'Vehículo', placa: 'TQK109', detalle: 'Revisión técnico-mecánica', documento: 'RTM-1188', vence: '2026-07-14', severidad: 'vencido' },
  { id: 'NV-503', categoria: 'Vehículo', placa: 'WBR774', detalle: 'Tarjeta de operación', documento: 'TO-9920', vence: '2026-12-01', severidad: 'ok' },
  { id: 'NV-504', categoria: 'Conductor', placa: 'SVL482', detalle: 'Licencia de conducción', documento: 'LIC-44521', vence: '2026-09-30', severidad: 'ok' },
  { id: 'NV-505', categoria: 'Conductor', placa: 'XZC031', detalle: 'Alcoholimetría', documento: 'ALC-0721', vence: '2026-07-21', severidad: 'porVencer' },
  { id: 'NV-506', categoria: 'Conductor', placa: 'RTN845', detalle: 'Examen médico', documento: 'EM-3310', vence: '2026-06-30', severidad: 'vencido' },
]

export const soportes: Soporte[] = [
  { id: 'SOP-3301', asunto: 'No carga plantilla de preventivos', motivo: 'Error carga masiva', empresa: 'Transportes Andinos S.A.', creado: '2026-07-20 09:12', estado: 'respondido', adjuntos: 2 },
  { id: 'SOP-3302', asunto: 'Despacho rechazado sin detalle', motivo: 'Integración Supertransporte', empresa: 'Coomotor Cooperativa', creado: '2026-07-21 08:30', estado: 'abierto', adjuntos: 1 },
  { id: 'SOP-3303', asunto: 'Solicitud acceso proveedor vigilado', motivo: 'Accesos', empresa: 'Rápido Tolima S.A.', creado: '2026-07-19 15:44', estado: 'cerrado', adjuntos: 0 },
]

// KPIs del dashboard
export const kpis = {
  despachosHoy: 128,
  despachosOk: 118,
  despachosFallidos: 4,
  enCola: 6,
  llegadasHoy: 96,
  mantenimientosMes: 342,
  novedadesActivas: 27,
  vencidos: 5,
}

// Serie últimas 14 jornadas (despachos procesados)
export const serieDespachos = [86, 92, 78, 104, 110, 96, 120, 118, 130, 112, 108, 124, 132, 128]

// Distribución de estados de cola (para donut)
export const estadoCola = [
  { label: 'Procesado', value: 118, color: 'var(--ok)' },
  { label: 'En cola', value: 6, color: 'var(--info)' },
  { label: 'Procesando', value: 4, color: 'var(--warn)' },
  { label: 'Fallido', value: 4, color: 'var(--danger)' },
]

export const logsRecientes = [
  { hora: '08:12', nivel: 'error', origen: 'DespachosQueue', msg: 'Timeout API Supertransporte (reintento 2/3)' },
  { hora: '08:05', nivel: 'info', origen: 'MantenimientoQueue', msg: 'Lote 12 procesado — 40 registros' },
  { hora: '07:58', nivel: 'warn', origen: 'AuthVigia', msg: 'Token Vigia próximo a expirar' },
  { hora: '07:41', nivel: 'info', origen: 'DespachosQueue', msg: 'Radicado 8841233 confirmado' },
]
