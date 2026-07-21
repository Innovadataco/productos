import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm';

export default class TblMotivosSoportes extends BaseModel {
  public static table = 'tbl_motivos_soportes';
  @column({ isPrimary: true, columnName: 'mos_id' })
  public id: number
  @column({ columnName: 'mos_descripcion' }) 
  public descripcion: string;
}
