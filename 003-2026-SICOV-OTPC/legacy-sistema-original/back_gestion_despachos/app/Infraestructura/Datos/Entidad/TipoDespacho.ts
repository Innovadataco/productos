import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblTipoDespachos extends BaseModel {

  @column({ isPrimary: true, columnName: 'ttd_id' }) public id: number

  @column({ columnName: 'ttd_descripcion' }) public descripcion: string

  @column({ columnName: 'ttd_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true , columnName: 'ttd_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'ttd_actualizacion' }) public updatedAt: DateTime
}
