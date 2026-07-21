import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'


export default class TblNivelServicios extends BaseModel {
  public static table = 'tbl_nivel_servicios'

  @column({ isPrimary: true, columnName: 'tns_id' }) public id: number
  @column({ columnName: 'tns_nombre' }) public nombre: string
}
