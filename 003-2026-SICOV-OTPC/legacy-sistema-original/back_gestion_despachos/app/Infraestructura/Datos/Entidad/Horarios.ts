import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblHorarios extends BaseModel {

  @column({ isPrimary: true, columnName: 'hrs_id' }) public id: number

  @column({ columnName: 'hrs_dia_id' }) public idDia: number

  @column({ columnName: 'hrs_codigo_ruta' }) public codigoRuta: number

  @column({ columnName: 'hrs_hora_salida' }) public horaSalida: string

  @column({ columnName: 'hrs_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true , columnName: 'hrs_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'hrs_actualizacion' }) public updatedAt: DateTime
}
