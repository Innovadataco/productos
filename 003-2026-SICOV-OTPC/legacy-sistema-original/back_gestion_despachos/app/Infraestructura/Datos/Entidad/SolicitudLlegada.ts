import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon'

export default class TblSolicitudLlegada extends BaseModel {
  public static table = 'tbl_llegadas_solicitudes'

  public static readonly createdAtColumn = 'lle_sol_fecha_creacion'
  public static readonly updatedAtColumn = 'lle_sol_fecha_actualizacion'

  @column({ isPrimary: true, columnName: 'lle_sol_id' })
  public id: number

  @column({ columnName: 'lle_sol_payload', serialize: (value) => value, prepare: (value) => value })
  public payload: Record<string, unknown>

  @column({ columnName: 'lle_sol_nit_vigilado' })
  public nitVigilado: string

  @column({ columnName: 'lle_sol_usuario_id' })
  public usuarioId: string

  @column({ columnName: 'lle_sol_fuente' })
  public fuenteDato: string

  @column({ columnName: 'lle_sol_tipo_llegada' })
  public tipoLlegada: number

  @column({ columnName: 'lle_sol_id_despacho' })
  public idDespacho: number | null

  @column({ columnName: 'lle_sol_placa' })
  public placa: string

  @column({ columnName: 'lle_sol_procesado' })
  public procesado: boolean

  @column({ columnName: 'lle_sol_id_llegada_externo' })
  public idLlegadaExterno: number | null

  @column({ columnName: 'lle_sol_respuesta_externa', serialize: (value) => value, prepare: (value) => value })
  public respuestaExterna: Record<string, unknown> | null

  @column({ columnName: 'lle_sol_error_externo' })
  public errorExterno: string | null

  @column.dateTime({ columnName: 'lle_sol_fecha_creacion', autoCreate: true })
  public fechaCreacion: DateTime

  @column.dateTime({ columnName: 'lle_sol_fecha_actualizacion', autoCreate: true, autoUpdate: true })
  public fechaActualizacion: DateTime
}
