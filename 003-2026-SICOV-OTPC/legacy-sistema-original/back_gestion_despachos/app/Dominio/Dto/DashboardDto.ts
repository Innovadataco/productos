export class DashboardResumenDto {
  public nitEmpresa: string
  public nombreEmpresa: string
  public mantenimientoCorrectivo: number
  public mantenimientoPreventivo: number
  public alistamiento: number
  public autorizaciones: number
  public novedades: number
  public despachos: number
  public fecha?: string

  constructor(
    nitEmpresa: string = '',
    nombreEmpresa: string = '',
    mantenimientoCorrectivo: number = 0,
    mantenimientoPreventivo: number = 0,
    alistamiento: number = 0,
    autorizaciones: number = 0,
    novedades: number = 0,
    despachos: number = 0,
    fecha?: string
  ) {
    this.nitEmpresa = nitEmpresa
    this.nombreEmpresa = nombreEmpresa
    this.mantenimientoCorrectivo = mantenimientoCorrectivo
    this.mantenimientoPreventivo = mantenimientoPreventivo
    this.alistamiento = alistamiento
    this.autorizaciones = autorizaciones
    this.novedades = novedades
    this.despachos = despachos
    this.fecha = fecha
  }
}

export class DashboardLogMantenimientoDto {
  public tipo: string
  public fechaDiligenciamiento: string
  public placa: string
  public procesado: boolean
  public mantenimientoId: number
  public nit: string
  public nombre: string

  constructor(
    tipo: string = '',
    fechaDiligenciamiento: string = '',
    placa: string = '',
    procesado: boolean = false,
    mantenimientoId: number = 0,
    nit: string = '',
    nombre: string = ''
  ) {
    this.tipo = tipo
    this.fechaDiligenciamiento = fechaDiligenciamiento
    this.placa = placa
    this.procesado = procesado
    this.mantenimientoId = mantenimientoId
    this.nit = nit
    this.nombre = nombre
  }
}
