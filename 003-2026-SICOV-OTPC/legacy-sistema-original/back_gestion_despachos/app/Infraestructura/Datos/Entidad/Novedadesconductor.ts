import { BaseModel, beforeCreate, beforeUpdate, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';


export default class TblNovedadesconductor extends BaseModel {
  public static table = 'tbl_novedades_conductores'

  @column({ isPrimary: true, columnName: 'non_id' }) public id: number

  @column({ columnName: 'non_id_novedad' }) public idNovedad: number
  @column({ columnName: 'non_tipo_identificacion_conductor' }) public tipoIdentificacionConductor: string
  @column({ columnName: 'non_numero_identificacion' }) public numeroIdentificacion: string
  @column({ columnName: 'non_primer_nombre_conductor' }) public primerNombreConductor: string
  @column({ columnName: 'non_segundo_nombre_conductor' }) public segundoNombreConductor: string
  @column({ columnName: 'non_primer_apellido_conductor' }) public primerApellidoConductor: string
  @column({ columnName: 'non_segundo_apellido_conductor' }) public segundoApellidoConductor: string
  @column({ columnName: 'non_id_prueba_alcoholimetria' }) public idPruebaAlcoholimetria: string
  @column({ columnName: 'non_resultado_prueba_alcoholimetria' }) public resultadoPruebaAlcoholimetria: string
  @column.date({ columnName: 'non_fecha_ultima_prueba_alcoholimetria' }) public fechaUltimaPruebaAlcoholimetria: DateTime
  @column({ columnName: 'non_licencia_conduccion' }) public licenciaConduccion: string
  @column({ columnName: 'non_id_examen_medico' }) public idExamenMedico: string
  @column.date({ columnName: 'non_fecha_ultimo_examen_medico' }) public fechaUltimoExamenMedico: DateTime
  @column({ columnName: 'non_observaciones' }) public observaciones: string
  @column.dateTime({ columnName: 'non_fecha_creacion' }) public fechaCreacion: DateTime
  @column.dateTime({ columnName: 'non_fecha_actualizacion' }) public fechaActualizacion: DateTime
  @column({ columnName: 'non_estado' }) public estado: boolean
   @column({ columnName: 'non_procesado' }) public procesado: boolean
  @column.date({ columnName: 'non_fecha_vencimiento_licencia' }) public fechaVencimientoLicencia: DateTime
  @beforeCreate()
  public static setFechaCreacion(novedad: TblNovedadesconductor) {
    novedad.fechaCreacion = DateTime.now()
  }

  @beforeUpdate()
  public static setFechaActualizacion(novedad: TblNovedadesconductor) {
    novedad.fechaActualizacion = DateTime.now()
  }
}
