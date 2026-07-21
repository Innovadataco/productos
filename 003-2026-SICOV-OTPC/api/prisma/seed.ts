import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  // Limpieza idempotente
  await db.$transaction([
    db.logError.deleteMany(), db.despacho.deleteMany(), db.llegada.deleteMany(),
    db.mantenimiento.deleteMany(), db.novedad.deleteMany(), db.soporte.deleteMany(),
    db.ruta.deleteMany(), db.empresa.deleteMany(), db.usuario.deleteMany(), db.rol.deleteMany(),
  ])

  // Roles
  const [admin, cliente, operador] = await Promise.all([
    db.rol.create({ data: { nombre: 'administrador' } }),
    db.rol.create({ data: { nombre: 'cliente' } }),
    db.rol.create({ data: { nombre: 'operador' } }),
  ])

  const hash = (c: string) => bcrypt.hashSync(c, 10)
  await db.usuario.createMany({
    data: [
      { identificacion: '1032456789', usuario: 'admin', nombre: 'Camila Restrepo', clave: hash('admin'), rolId: admin.id },
      { identificacion: '1088990011', usuario: 'operador', nombre: 'Andrés Villa', clave: hash('operador'), rolId: operador.id },
      { identificacion: '900853057', usuario: 'cliente', nombre: 'Transportes Andinos', clave: hash('cliente'), rolId: cliente.id, empresaNit: '900853057' },
    ],
  })

  const empresas = [
    { nit: '900853057', nombre: 'Transportes Andinos S.A.', dias: 160 },
    { nit: '830001234', nombre: 'Flota La Macarena Ltda.', dias: 60 },
    { nit: '860500999', nombre: 'Rápido Tolima S.A.', dias: -5 },
    { nit: '891800456', nombre: 'Coomotor Cooperativa', dias: 200 },
    { nit: '900112233', nombre: 'Expreso Bolivariano', dias: 110 },
  ]
  for (const e of empresas) {
    await db.empresa.create({
      data: { nit: e.nit, nombre: e.nombre, token: Math.random().toString(16).slice(2, 14), vigenteHasta: dias(e.dias), activo: e.dias > 0 },
    })
  }

  await db.despacho.createMany({
    data: [
      { codigo: 'DSP-24817', placa: 'SVL482', empresa: 'Transportes Andinos S.A.', nit: '900853057', ruta: 'Bogotá – Ibagué', origen: 'Terminal Salitre', destino: 'Terminal Ibagué', fechaHora: hoy(6, 15), estado: 'procesado', respuesta: 'OK · radicado 8841200' },
      { codigo: 'DSP-24818', placa: 'TQK109', empresa: 'Flota La Macarena Ltda.', nit: '830001234', ruta: 'Neiva – Bogotá', origen: 'Terminal Neiva', destino: 'Terminal Salitre', fechaHora: hoy(6, 40), estado: 'procesando', reintentos: 1 },
      { codigo: 'DSP-24819', placa: 'WBR774', empresa: 'Rápido Tolima S.A.', nit: '860500999', ruta: 'Bogotá – Ibagué', origen: 'Terminal Ibagué', destino: 'Terminal Salitre', fechaHora: hoy(7, 5), estado: 'pendiente' },
      { codigo: 'DSP-24820', placa: 'XZC031', empresa: 'Coomotor Cooperativa', nit: '891800456', ruta: 'Cali – Popayán', origen: 'Terminal Cali', destino: 'Terminal Popayán', fechaHora: hoy(7, 20), estado: 'fallido', reintentos: 3, respuesta: 'Error 422 · placa no vigente' },
      { codigo: 'DSP-24821', placa: 'UHM560', empresa: 'Expreso Bolivariano', nit: '900112233', ruta: 'Bucaramanga – Cúcuta', origen: 'Terminal Bucaramanga', destino: 'Terminal Cúcuta', fechaHora: hoy(7, 45), estado: 'procesado', respuesta: 'OK · radicado 8841233' },
      { codigo: 'DSP-24822', placa: 'PKD298', empresa: 'Transportes Andinos S.A.', nit: '900853057', ruta: 'Medellín – Montería', origen: 'Terminal Medellín', destino: 'Terminal Montería', fechaHora: hoy(8, 10), estado: 'pendiente' },
    ],
  })

  await db.llegada.createMany({
    data: [
      { codigo: 'LLG-19004', placa: 'SVL482', empresa: 'Transportes Andinos S.A.', nit: '900853057', tipoLlegada: 'Programada', terminal: 'Terminal Ibagué', fechaHora: hoy(11, 2), estado: 'procesado' },
      { codigo: 'LLG-19005', placa: 'UHM560', empresa: 'Expreso Bolivariano', nit: '900112233', tipoLlegada: 'Programada', terminal: 'Terminal Cúcuta', fechaHora: hoy(12, 35), estado: 'procesando', reintentos: 1 },
      { codigo: 'LLG-19006', placa: 'YFG612', empresa: 'Flota La Macarena Ltda.', nit: '830001234', tipoLlegada: 'No programada', terminal: 'Terminal Salitre', fechaHora: hoy(12, 50), estado: 'pendiente' },
      { codigo: 'LLG-19007', placa: 'RTN845', empresa: 'Rápido Tolima S.A.', nit: '860500999', tipoLlegada: 'Programada', terminal: 'Terminal Salitre', fechaHora: hoy(13, 15), estado: 'fallido', reintentos: 2 },
    ],
  })

  await db.mantenimiento.createMany({
    data: [
      { codigo: 'MNT-7712', placa: 'SVL482', empresa: 'Transportes Andinos S.A.', tipo: 'Preventivo', descripcion: 'Cambio aceite y filtros — 40.000 km', fecha: dias(-2), responsable: 'C. Rodríguez', estado: 'enviado' },
      { codigo: 'MNT-7713', placa: 'TQK109', empresa: 'Flota La Macarena Ltda.', tipo: 'Correctivo', descripcion: 'Reemplazo pastillas de freno', fecha: dias(-1), responsable: 'J. Pérez', estado: 'en_cola' },
      { codigo: 'MNT-7714', placa: 'WBR774', empresa: 'Rápido Tolima S.A.', tipo: 'Alistamiento', descripcion: 'Alistamiento diario — checklist 32 ítems', fecha: dias(0), responsable: 'M. Gómez', estado: 'registrado' },
      { codigo: 'MNT-7715', placa: 'XZC031', empresa: 'Coomotor Cooperativa', tipo: 'Autorización', descripcion: 'Autorización salida ruta especial', fecha: dias(0), responsable: 'A. Salazar', estado: 'fallido' },
      { codigo: 'MNT-7716', placa: 'UHM560', empresa: 'Expreso Bolivariano', tipo: 'Preventivo', descripcion: 'Revisión sistema de suspensión', fecha: dias(-3), responsable: 'C. Rodríguez', estado: 'enviado' },
    ],
  })

  await db.novedad.createMany({
    data: [
      { codigo: 'NV-501', categoria: 'Vehículo', placa: 'SVL482', detalle: 'SOAT', documento: 'SOAT-2026', vence: dias(12), severidad: 'porVencer' },
      { codigo: 'NV-502', categoria: 'Vehículo', placa: 'TQK109', detalle: 'Revisión técnico-mecánica', documento: 'RTM-1188', vence: dias(-7), severidad: 'vencido' },
      { codigo: 'NV-503', categoria: 'Vehículo', placa: 'WBR774', detalle: 'Tarjeta de operación', documento: 'TO-9920', vence: dias(133), severidad: 'ok' },
      { codigo: 'NV-504', categoria: 'Conductor', placa: 'SVL482', detalle: 'Licencia de conducción', documento: 'LIC-44521', vence: dias(70), severidad: 'ok' },
      { codigo: 'NV-505', categoria: 'Conductor', placa: 'XZC031', detalle: 'Alcoholimetría', documento: 'ALC-0721', vence: dias(0), severidad: 'porVencer' },
      { codigo: 'NV-506', categoria: 'Conductor', placa: 'RTN845', detalle: 'Examen médico', documento: 'EM-3310', vence: dias(-21), severidad: 'vencido' },
    ],
  })

  await db.soporte.createMany({
    data: [
      { codigo: 'SOP-3301', asunto: 'No carga plantilla de preventivos', motivo: 'Error carga masiva', empresa: 'Transportes Andinos S.A.', estado: 'respondido', adjuntos: 2 },
      { codigo: 'SOP-3302', asunto: 'Despacho rechazado sin detalle', motivo: 'Integración Supertransporte', empresa: 'Coomotor Cooperativa', estado: 'abierto', adjuntos: 1 },
      { codigo: 'SOP-3303', asunto: 'Solicitud acceso proveedor vigilado', motivo: 'Accesos', empresa: 'Rápido Tolima S.A.', estado: 'cerrado', adjuntos: 0 },
    ],
  })

  await db.ruta.createMany({
    data: [
      { codigo: 'RT-1042', ruta: 'Bogotá – Ibagué', empresa: 'Transportes Andinos S.A.', paradas: 6, clase: 'Intermunicipal', habilitada: true },
      { codigo: 'RT-1055', ruta: 'Cali – Popayán', empresa: 'Coomotor Cooperativa', paradas: 4, clase: 'Intermunicipal', habilitada: true },
      { codigo: 'RT-1071', ruta: 'Medellín – Montería', empresa: 'Transportes Andinos S.A.', paradas: 9, clase: 'Larga distancia', habilitada: true },
      { codigo: 'RT-1088', ruta: 'Bucaramanga – Cúcuta', empresa: 'Expreso Bolivariano', paradas: 5, clase: 'Intermunicipal', habilitada: false },
      { codigo: 'RT-1093', ruta: 'Neiva – Bogotá', empresa: 'Flota La Macarena Ltda.', paradas: 7, clase: 'Larga distancia', habilitada: true },
    ],
  })

  await db.logError.createMany({
    data: [
      { origen: 'DespachosQueue', nivel: 'error', mensaje: 'Timeout API Supertransporte (reintento 2/3)' },
      { origen: 'MantenimientoQueue', nivel: 'info', mensaje: 'Lote 12 procesado — 40 registros' },
      { origen: 'AuthVigia', nivel: 'warn', mensaje: 'Token Vigia próximo a expirar' },
      { origen: 'DespachosQueue', nivel: 'info', mensaje: 'Radicado 8841233 confirmado' },
    ],
  })

  console.log('✔ Semilla cargada: 3 usuarios, 5 empresas, 6 despachos, 4 llegadas, 5 mantenimientos, 6 novedades.')
}

function hoy(h: number, m: number) {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}
function dias(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
