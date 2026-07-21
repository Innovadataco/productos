import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon'

export type TipoMantenimientoJob = 'base' | 'preventivo' | 'correctivo' | 'alistamiento' | 'autorizacion'
export type EstadoMantenimientoJob = 'pendiente' | 'procesando' | 'procesado' | 'fallido'

export default class TblMantenimientoJob extends BaseModel {
  public static table = 'tbl_mantenimiento_jobs'

  @column({ isPrimary: true, columnName: 'tmj_id' })
  public id?: number

  @column({ columnName: 'tmj_tipo' })
  public tipo: TipoMantenimientoJob

  @column({ columnName: 'tmj_mantenimiento_local_id' })
  public mantenimientoLocalId: number | null

  @column({ columnName: 'tmj_detalle_id' })
  public detalleId: number | null

  @column({ columnName: 'tmj_vigilado_id' })
  public vigiladoId: string

  @column({ columnName: 'tmj_usuario_documento' })
  public usuarioDocumento: string

  @column({ columnName: 'tmj_rol_id' })
  public rolId: number

  @column({ columnName: 'tmj_estado' })
  public estado: EstadoMantenimientoJob

  @column({ columnName: 'tmj_reintentos' })
  public reintentos: number

  @column({ columnName: 'tmj_ultimo_error' })
  public ultimoError?: string | null

  @column.dateTime({ columnName: 'tmj_siguiente_intento' })
  public siguienteIntento: DateTime

  @column({ columnName: 'tmj_payload' })
  public payload?: any

  @column.dateTime({ autoCreate: true, columnName: 'tmj_creado' })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tmj_actualizado' })
  public updatedAt: DateTime
}
