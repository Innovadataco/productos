import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblCodigoClasePorGrupos extends BaseModel {

  @column({ isPrimary: true, columnName: 'cpg_id' }) public id: number

  @column({ columnName: 'cpg_descripcion' }) public descripcion: string

  @column({ columnName: 'cpg_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true , columnName: 'cpg_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'cpg_actualizacion' }) public updatedAt: DateTime
}
