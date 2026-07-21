import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon';

export class TblLogEstados extends BaseModel {
  public static table = 'tbl_log_estados';
  
  @column({ isPrimary: true, columnName: 'tle_id' })
  public id?: number

  @column({ columnName: 'tle_vigilado_id' }) public vigiladoId: number;
  @column({ columnName: 'tle_estado_id' }) public estadoId: number;

  @column.dateTime({ autoCreate: true, columnName: 'tle_creacion' })
  public creacion: DateTime

 
}


