import { DateTime } from 'luxon';
import { BaseModel, BelongsTo, belongsTo, column} from '@ioc:Adonis/Lucid/Orm';
import { Archivo } from 'App/Dominio/Datos/Entidades/archivo';

export default class TblArchivo extends BaseModel {
  @column({ isPrimary: true, columnName: 'arc_id' })  public id?: number
  @column({ columnName: 'arc_poliza' }) public poliza?: number
  @column({ columnName: 'arc_nombre' }) public nombre: string
  @column({ columnName: 'arc_nombre_original' }) public nombreOriginal: string
  @column({ columnName: 'arc_ruta' }) public ruta: string

  public establecerArchivoDb (archivo: Archivo) {
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
  }




}
