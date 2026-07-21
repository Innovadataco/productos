import { DateTime } from 'luxon';
import { BaseModel, BelongsTo, belongsTo, column} from '@ioc:Adonis/Lucid/Orm';
import TblUsuarios from './Usuario';

export default class TblEstadosEnviados extends BaseModel {
  @column({ isPrimary: true, columnName: 'env_id' })  public id?: number  
  @column({ columnName: 'env_estado' }) public estado: number  
  @column({ columnName: 'env_vigilado_id' }) public vigiladoId: string
  @column.dateTime({ autoCreate: true , columnName: 'env_creado'}) public createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'env_actualizado' }) public updatedAt: DateTime 

  
 /*  public establecerArchivoDb (archivo: Archivo) {
    this.id = archivo.id
    this.poliza = archivo.poliza
    this.nombre = archivo.nombre
    this.nombreOriginal = archivo.nombreOriginal
    this.ruta = archivo.ruta
  }

  public estableceArchivoConId (archivo: Archivo) {
    this.poliza = archivo.poliza
    this.nombre = archivo.nombre
    this.nombreOriginal = archivo.nombreOriginal
    this.ruta = archivo.ruta
  }

  public obtenerArchivo (): Archivo {
    const archivo = new Archivo()
    archivo.id = this.id
    archivo.poliza = this.poliza
    archivo.nombre = this.nombre
    archivo.nombreOriginal = this.nombreOriginal
    archivo.ruta = this.ruta
    return archivo
  } */
/* 
  @belongsTo(() => TblUsuarios, {
    localKey: 'numero',
    foreignKey: 'poliza',
  })
  public polizas: BelongsTo<typeof TblPolizas>
 */

}
