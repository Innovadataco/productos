import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblDepartamentos extends BaseModel {

  @column({ isPrimary: true, columnName: 'tdp_id' }) public id: number

  @column({ columnName: 'tdp_codigo_departamento' }) public codigoDepartamento: number

  @column({ columnName: 'tdp_nombre' }) public nombre: string

  @column.dateTime({ autoCreate: true , columnName: 'tdp_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tdp_actualizacion' }) public updatedAt: DateTime
}
