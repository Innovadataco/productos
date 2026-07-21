import { BaseModel, BelongsTo, belongsTo, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import TblCodigoClasePorGrupos from './CodigoClaseGrupos';

export default class TblClaseVehiculos extends BaseModel {

  @column({ isPrimary: true, columnName: 'tcv_id' }) public id: number

  @column({ columnName: 'tcv_descripcion' }) public descripcion: string

  @column({ columnName: 'tcv_clase_por_grupo_id' }) public idClasePorGrupo: number

  @column({ columnName: 'tcv_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true , columnName: 'tcv_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tcv_actualizacion' }) public updatedAt: DateTime

  @belongsTo (() => TblCodigoClasePorGrupos, {
    localKey: 'id',
    foreignKey: 'idClasePorGrupo',
  })
  public clasesPorGrupos: BelongsTo<typeof TblCodigoClasePorGrupos>
}
