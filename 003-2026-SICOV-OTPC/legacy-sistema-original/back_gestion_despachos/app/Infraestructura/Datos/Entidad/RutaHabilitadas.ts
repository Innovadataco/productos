import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { RutaHabilitada } from 'App/Dominio/Datos/Entidades/RutaHabilitada';
import { DateTime } from 'luxon';

export default class TblRutaHabilitadas extends BaseModel {

  @column({ isPrimary: true, columnName: 'trh_id' }) public id: number

  @column({ columnName: 'trh_codigo_unico_ruta' }) public idRuta: number

  @column({ columnName: 'trh_resolucion' }) public resolucion: string

  @column({ columnName: 'trh_resolucion_actual' }) public resolucionActual: string

  @column({ columnName: 'trh_fecha' }) public fecha: string

  @column({ columnName: 'trh_convenio' }) public convenio: string

  @column({ columnName: 'trh_fecha_convenio' }) public fechaConvenio: string

  @column({ columnName: 'trh_documento_convenio' }) public documentoConvenio: string

  @column({ columnName: 'trh_nombre_original_convenio' }) public nombreOriginalConvenio: string

  @column({ columnName: 'trh_ruta_archivo_convenio' }) public rutaArchivoConvenio: string

  @column({ columnName: 'trh_direccion_territorial' }) public direccionTerritorial: string

  @column({ columnName: 'trh_documento' }) public documento: string

  @column({ columnName: 'trh_nombre_original' }) public nombreOriginal: string

  @column({ columnName: 'trh_ruta_archivo' }) public rutaArchivo: string

  @column({ columnName: 'trh_observacion' }) public observacion: string

  @column({ columnName: 'corresponde' }) public corresponde: number

  @column.dateTime({ autoCreate: true , columnName: 'trh_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'trh_actualizacion' }) public updatedAt: DateTime

  public establecerRutaHabilitada(rutaHabilitada: RutaHabilitada) {
    this.idRuta = rutaHabilitada.idRuta!
    this.resolucion = rutaHabilitada.resolucion!
    this.resolucionActual = rutaHabilitada.resolucionActual!
    this.fecha = rutaHabilitada.fecha!
    this.convenio = rutaHabilitada.convenio!
    this.fechaConvenio = rutaHabilitada.fechaConvenio!
    this.direccionTerritorial = rutaHabilitada.direccionTerritorial!
    this.documento = rutaHabilitada.documento!
    this.nombreOriginal = rutaHabilitada.nombreOriginal!
    this.rutaArchivo = rutaHabilitada.rutaArchivo!
    this.documentoConvenio = rutaHabilitada.documentoConvenio!
    this.nombreOriginalConvenio = rutaHabilitada.nombreOriginalConvenio!
    this.rutaArchivoConvenio = rutaHabilitada.rutaArchivoConvenio!
    this.observacion = rutaHabilitada.observacion!
    this.corresponde = rutaHabilitada.corresponde!
  }

  public establecerRutaHabilitadaConId(rutaHabilitada: RutaHabilitada) {
    this.idRuta = rutaHabilitada.idRuta!
    this.resolucion = rutaHabilitada.resolucion!
    this.resolucionActual = rutaHabilitada.resolucionActual!
    this.fecha = rutaHabilitada.fecha!
    this.convenio = rutaHabilitada.convenio!
    this.fechaConvenio = rutaHabilitada.fechaConvenio!
    this.direccionTerritorial = rutaHabilitada.direccionTerritorial!
    this.documento = rutaHabilitada.documento!
    this.nombreOriginal = rutaHabilitada.nombreOriginal!
    this.rutaArchivo = rutaHabilitada.rutaArchivo!
    this.documentoConvenio = rutaHabilitada.documentoConvenio!
    this.nombreOriginalConvenio = rutaHabilitada.nombreOriginalConvenio!
    this.rutaArchivoConvenio = rutaHabilitada.rutaArchivoConvenio!
    this.observacion = rutaHabilitada.observacion!
    this.corresponde = rutaHabilitada.corresponde!
  }
}
