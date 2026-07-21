import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon'

export default class LogsErrores extends BaseModel {
  public static table = 'tbl_logs_errores';
  @column({ isPrimary: true, columnName: 'log_id'})
  public id: number

  @column({ columnName: 'log_mensaje' })
  public mensaje: string

  @column({ columnName: 'log_stack_trace' })
  public stack_trace: string

  @column({ columnName: 'log_usuario' })
  public usuario?: string

  @column({ columnName: 'log_endpoint' })
  public endpoint?: string

  @column.dateTime({ autoCreate: true, columnName: 'log_creacion' })
  public createdAt: DateTime

}
