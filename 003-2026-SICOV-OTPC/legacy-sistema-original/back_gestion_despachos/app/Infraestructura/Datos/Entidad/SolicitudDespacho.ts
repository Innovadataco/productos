import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon'

export type EstadoSolicitudDespacho = 'pendiente' | 'procesando' | 'procesado' | 'fallido'

export default class TblSolicitudDespacho extends BaseModel {
  public static table = 'tbl_despachos_solicitudes'

  public static readonly createdAtColumn = 'des_sol_fecha_creacion'
  public static readonly updatedAtColumn = 'des_sol_fecha_actualizacion'

  @column({ isPrimary: true, columnName: 'des_sol_id' })
  public id: number

  @column({ columnName: 'des_sol_payload', serialize: (value) => value, prepare: (value) => value })
  public payload: Record<string, unknown>

  @column({ columnName: 'des_sol_nit_vigilado' })
  public nitVigilado: string

  @column({ columnName: 'des_sol_usuario_id' })
  public usuarioId: string

  @column({ columnName: 'des_sol_fuente' })
  public fuenteDato: string

  @column({ columnName: 'des_sol_procesado' })
  public procesado: boolean

  @column({ columnName: 'des_sol_id_despacho_externo' })
  public idDespachoExterno: number | null

  @column({ columnName: 'des_sol_respuesta_externa', serialize: (value) => value, prepare: (value) => value })
  public respuestaExterna: Record<string, unknown> | null

  @column({ columnName: 'des_sol_error_externo' })
  public errorExterno: string | null

  @column({ columnName: 'des_sol_estado' })
  public estado: EstadoSolicitudDespacho

  @column({ columnName: 'des_sol_reintentos' })
  public reintentos: number

  @column({ columnName: 'des_sol_rol_id' })
  public rolId: number | null

  @column.dateTime({ columnName: 'des_sol_siguiente_intento' })
  public siguienteIntento: DateTime

  @column.dateTime({ columnName: 'des_sol_fecha_creacion', autoCreate: true })
  public fechaCreacion: DateTime

  @column.dateTime({ columnName: 'des_sol_fecha_actualizacion', autoCreate: true, autoUpdate: true })
  public fechaActualizacion: DateTime
}
