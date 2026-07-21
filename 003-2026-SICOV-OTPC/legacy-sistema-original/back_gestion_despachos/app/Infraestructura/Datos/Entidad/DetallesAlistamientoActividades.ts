import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblDetallesActividadesAlistamientos extends BaseModel {

  @column({ isPrimary: true, columnName: 'tda_id' }) public id: number
  @column({ columnName: 'tda_alistamiento_id' }) public alistamientoId: number
  @column({ columnName: 'tda_actividad_id' }) public actividadId: number  
  @column({ columnName: 'tda_estado' }) public estado: boolean
  @column.dateTime({ autoCreate: true , columnName: 'tda_creado'}) public createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tda_actualizado' }) public updatedAt: DateTime
}