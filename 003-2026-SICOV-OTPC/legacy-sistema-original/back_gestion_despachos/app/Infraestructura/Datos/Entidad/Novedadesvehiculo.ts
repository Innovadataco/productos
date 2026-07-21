import { BaseModel, beforeCreate, beforeUpdate, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblNovedadesvehiculo extends BaseModel {
  public static table = 'tbl_novedades_vehiculos'

  @column({ isPrimary: true, columnName: 'noh_id' })
  public id: number

  @column({ columnName: 'noh_id_novedad' })
  public idNovedad: number

  @column({ columnName: 'noh_placa' })
  public placa: string

  @column({ columnName: 'noh_soat' })
  public soat: string

  @column.date({ columnName: 'noh_fecha_vencimiento_soat' })
  public fechaVencimientoSoat: DateTime

  @column({ columnName: 'noh_revision_tecnico_mecanica' })
  public revisionTecnicoMecanica: string

  @column.date({ columnName: 'noh_fecha_revision_tecnico_mecanica' })
  public fechaRevisionTecnicoMecanica: DateTime

  @column({ columnName: 'noh_id_polizas' })
  public idPolizas: string

  @column({ columnName: 'noh_tipo_poliza' })
  public tipoPoliza: string

  @column({ columnName: 'noh_tarjeta_operacion' })
  public tarjetaOperacion: string

  @column.date({ columnName: 'noh_fecha_tarjeta_operacion' })
  public fechaVencimientoTarjetaOperacion: DateTime

  @column({ columnName: 'noh_id_matenimiento' })
  public idMatenimientoPreventivo: string

  @column.date({ columnName: 'noh_fecha_mantenimiento' })
  public fechaMantenimientoPreventivo: DateTime

  @column({ columnName: 'noh_id_protocolo_alistamiento_diario' })
  public idProtocoloAlistamientodiario: string

  @column.date({ columnName: 'noh_fecha_protocolo_alistamiento_diario' })
  public fechaProtocoloAlistamientodiario: DateTime

  @column({ columnName: 'noh_observaciones' })
  public observaciones: string

  @column({ columnName: 'noh_clase' })
  public clase: number

  @column({ columnName: 'noh_nivel_servicio' })
  public nivelServicio: number

  @column.dateTime({ columnName: 'noh_fecha_creacion' })
  public fechaCreacion: DateTime

  @column.dateTime({ columnName: 'noh_fecha_actualizacion' })
  public fechaActualizacion: DateTime

  @column({ columnName: 'noh_estado' })
  public estado: boolean

  @column({ columnName: 'noh_id_poliza_contractual' })
  public idPolizaContractual: string

  @column({ columnName: 'noh_id_poliza_extracontractual' })
  public idPolizaExtracontractual: string

   @column({ columnName: 'noh_procesado' }) public procesado: boolean

  @column({ columnName: 'noh_vigenciacontractual' })
  public vigenciaContractual: Date
  @column({ columnName: 'noh_vigenciaextracontractual' })
  public vigenciaExtracontractual: Date

  @beforeCreate()
  public static setFechaCreacion(novedadvehiculo: TblNovedadesvehiculo) {
    novedadvehiculo.fechaCreacion = DateTime.now()
  }

  @beforeUpdate()
  public static fechaActualizacion(novedadvehiculo: TblNovedadesvehiculo) {
    novedadvehiculo.fechaActualizacion = DateTime.now()
  }
}
