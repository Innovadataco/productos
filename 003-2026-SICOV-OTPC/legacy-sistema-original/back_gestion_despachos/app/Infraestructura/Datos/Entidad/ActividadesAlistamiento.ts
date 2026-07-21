import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblActividadesAlistamiento extends BaseModel {

  @column({ isPrimary: true, columnName: 'taa_id' }) public id: number
  @column({ columnName: 'taa_nombre' }) public nombre: string  
  @column({ columnName: 'taa_estado' }) public estado: boolean
  @column.dateTime({ autoCreate: true , columnName: 'taa_creado'}) public createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'taa_actualizado' }) public updatedAt: DateTime

}