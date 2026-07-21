import { BaseModel, HasMany, HasOne, column, hasMany, hasOne } from '@ioc:Adonis/Lucid/Orm'
import { DateTime } from 'luxon';
import TblUsuarios from './Usuario';
export class TblProveedoresVigilados extends BaseModel {

  public static table = 'tbl_proveedores_vigilados';

  @column({ columnName: 'tpv_id' }) public id?: number;
  @column({ columnName: 'tpv_empresa' }) public idEmpresa: string;
  @column({ columnName: 'tpv_vigilado' }) public idVigilado: string;
  @column({ columnName: 'tpv_token' }) public token: string;
  @column({ columnName: 'tpv_estado' }) public estado: boolean;
  @column({ columnName: 'tpv_fecha_inicial' }) public fechaInicial: Date;
  @column({ columnName: 'tpv_fecha_final' }) public fechaFinal: Date;
  @column({ columnName: 'tpv_documento' }) public documento?: string;
  @column({ columnName: 'tpv_ruta' }) public ruta?: string;
  @column({ columnName: 'tpv_nombre_original' }) public nombreOriginal?: string;

  @column.dateTime({ autoCreate: true, columnName: 'tpv_created_at' })
  public creacion: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tpv_updated_at' })
  public actualizacion: DateTime


  public establecerEstado() {
    this.estado = !this.estado

  }


  @hasOne(() => TblUsuarios, {
    localKey: 'idEmpresa',
    foreignKey: 'usuario',
  })
  public empresaTecno: HasOne<typeof TblUsuarios>

}
