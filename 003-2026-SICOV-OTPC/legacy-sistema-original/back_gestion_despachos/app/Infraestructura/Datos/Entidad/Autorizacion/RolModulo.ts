import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import TblRoles from './Rol'
import TblModulos from './Modulo'

export default class TblRolesModulos extends BaseModel {
  public static readonly table = 'tbl_roles_modulos'

  @column({ isPrimary: true, columnName: 'rom_id' })
  public id: number

  @column({ columnName: 'rom_rol_id' })
  public rolId: number

  @column({ columnName: 'rom_modulo_id' })
  public moduloId: number

  @column.dateTime({ autoCreate: true, columnName: 'rom_creado' })
  public creacion: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'rom_actualizado' })
  public actualizacion: DateTime

  @belongsTo(() => TblRoles, {
    localKey: 'id',
    foreignKey: 'rolId',
  })
  public rol: BelongsTo<typeof TblRoles>

  @belongsTo(() => TblModulos, {
    localKey: 'id',
    foreignKey: 'moduloId',
  })
  public modulo: BelongsTo<typeof TblModulos>
}
