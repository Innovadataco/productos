import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblTipoMantenimiento extends BaseModel {

  @column({ isPrimary: true, columnName: 'ttm_id' }) public id: number

  @column({ columnName: 'ttm_nombre' }) public descripcion: string

  @column({ columnName: 'ttm_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true , columnName: 'ttm_creado'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'ttm_actualizado' }) public updatedAt: DateTime
}
