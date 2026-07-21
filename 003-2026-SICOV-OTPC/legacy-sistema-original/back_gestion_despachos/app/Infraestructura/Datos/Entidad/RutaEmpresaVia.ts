import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { RutaEmpresaVia } from 'App/Dominio/Datos/Entidades/RutaEmpresaVia';
import { DateTime } from 'luxon';

export default class TblRutaEmpresaVias extends BaseModel {

  @column({ isPrimary: true, columnName: 'rev_id' }) public id: number

  @column({ columnName: 'rev_codigo_unico_ruta' }) public codigoRuta: number

  @column({ columnName: 'rev_codigo_via' }) public codigoVia: string

  @column({ columnName: 'rev_via' }) public via: string

  @column({ columnName: 'rev_nueva_via' }) public nuevaVia: string

  @column({ columnName: 'rev_corresponde' }) public corresponde: number

  @column.dateTime({ autoCreate: true , columnName: 'rev_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'rev_actualizacion' }) public updatedAt: DateTime

  public establecerRutaEmpresaVia(rutaEmpresaVia: RutaEmpresaVia) {
    this.codigoRuta = rutaEmpresaVia.codigoRuta!
    this.codigoVia = rutaEmpresaVia.codigoVia!
    this.via = rutaEmpresaVia.via!
    this.nuevaVia = rutaEmpresaVia.nuevaVia!
    this.corresponde = rutaEmpresaVia.corresponde!
  }

  public establecerRutaEmpresaViaConId(rutaEmpresaVia: RutaEmpresaVia) {
    this.codigoRuta = rutaEmpresaVia.codigoRuta!
    this.codigoVia = rutaEmpresaVia.codigoVia!
    this.via = rutaEmpresaVia.via!
    this.nuevaVia = rutaEmpresaVia.nuevaVia!
    this.corresponde = rutaEmpresaVia.corresponde!
  }
}
