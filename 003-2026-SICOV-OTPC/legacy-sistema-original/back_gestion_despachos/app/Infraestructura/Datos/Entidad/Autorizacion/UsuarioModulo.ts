import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import TblUsuarios from '../Usuario'
import TblModulos from './Modulo'

export default class TblUsuariosModulos extends BaseModel {
  public static readonly table = 'tbl_usuarios_modulos'

  @column({ isPrimary: true, columnName: 'usm_id' })
  public id: number

  @column({ columnName: 'usm_usuario_id' })
  public usuarioId: number

  @column({ columnName: 'usm_modulo_id' })
  public moduloId: number

  @column({ columnName: 'usm_estado' })
  public estado: boolean

  @column.dateTime({ autoCreate: true, columnName: 'usm_creado' })
  public creacion: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'usm_actualizado' })
  public actualizacion: DateTime

  @belongsTo(() => TblUsuarios, {
    localKey: 'id',
    foreignKey: 'usuarioId',
  })
  public usuario: BelongsTo<typeof TblUsuarios>

  @belongsTo(() => TblModulos, {
    localKey: 'id',
    foreignKey: 'moduloId',
  })
  public modulo: BelongsTo<typeof TblModulos>
}
