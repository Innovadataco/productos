import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblDias extends BaseModel {

  @column({ isPrimary: true, columnName: 'tds_id' }) public id: number

  @column({ columnName: 'tds_descripcion' }) public descripcion: string

  @column({ columnName: 'tds_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true , columnName: 'tds_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tds_actualizacion' }) public updatedAt: DateTime
}
