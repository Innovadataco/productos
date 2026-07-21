import { BaseModel, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import TblCentroPoblados from './CentroPoblado';

export default class TblTerminales extends BaseModel {
  public static table = 'tbl_terminales'

  @column({ isPrimary: true, columnName: 'ter_id' }) 
  public id: number

  @column({ columnName: 'ter_nombre' }) 
  public nombre: string

  @column({ columnName: 'ter_estado' }) 
  public estado: boolean

  @column({ columnName: 'ter_nit' }) 
  public nit: number

  @column.dateTime({ autoCreate: true, columnName: 'ter_creacion' }) 
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'ter_actualizacion' }) 
  public updatedAt: DateTime

  // Relación uno a muchos con centros poblados
  @hasMany(() => TblCentroPoblados, {
    localKey: 'id',
    foreignKey: 'terminal',
  })
  public centrosPoblados: HasMany<typeof TblCentroPoblados>
}
