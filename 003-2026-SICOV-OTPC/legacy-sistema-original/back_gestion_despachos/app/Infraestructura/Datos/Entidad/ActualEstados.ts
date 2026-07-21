import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon';

export class TblActualEstados extends BaseModel {
  public static table = 'tbl_actual_estados';
  
  @column({ isPrimary: true, columnName: 'tae_id' })
  public id?: number

  @column({ columnName: 'tae_vigilado_id' }) public vigiladoId: string;
  @column({ columnName: 'tae_estado_id' }) public estadoId: number;

  @column.dateTime({ autoCreate: true, columnName: 'tae_creacion' })
  public creacion: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tae_actualizacion' })
  public actualizacion: DateTime

 
}


