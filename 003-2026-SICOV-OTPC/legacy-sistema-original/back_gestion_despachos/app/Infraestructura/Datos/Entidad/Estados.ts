import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm'

export class TblEstados extends BaseModel {
  public static table = 'tbl_estados';
  
  @column({ isPrimary: true, columnName: 'est_id' })
  public id?: number

  @column({ columnName: 'est_nombre' }) public nombre: string;
  @column({ columnName: 'est_estado' }) public estado: boolean;

 
}


