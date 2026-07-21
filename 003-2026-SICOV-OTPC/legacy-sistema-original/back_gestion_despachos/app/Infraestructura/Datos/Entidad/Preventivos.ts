import { BaseModel, column, beforeCreate } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import Env from '@ioc:Adonis/Core/Env';

export default class TblPreventivo extends BaseModel {

  @column({ isPrimary: true, columnName: 'tpv_id' }) public id?: number

  @column({ columnName: 'tpv_placa' }) public placa: string
  @column({ columnName: 'tpv_fecha' }) public fecha: Date
  @column({ columnName: 'tpv_hora' }) public hora: string
  @column({ columnName: 'tpv_nit' }) public nit: string
  @column({ columnName: 'tpv_razon_social' }) public razonSocial: string
  @column({ columnName: 'tpv_tipo_identificacion' }) public tipoIdentificacion: number
  @column({ columnName: 'tpv_numero_identificacion' }) public numeroIdentificacion: number
  @column({ columnName: 'tpv_nombres_responsable' }) public nombresResponsable: string
  @column({ columnName: 'tpv_mantenimiento_id' }) public mantenimientoId: number
  @column({ columnName: 'tpv_detalle_actividades' }) public detalleActividades: string

  @column({ columnName: 'tpv_estado' }) public estado?: boolean
  @column({ columnName: 'tpv_procesado' }) public procesado?: boolean
  @column.dateTime({ autoCreate: true , columnName: 'tpv_creado'}) public createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tpv_actualizado' }) public updatedAt: DateTime

  @beforeCreate()
  public static ajustarFechaCreacion(preventivo: TblPreventivo) {
    const offset = Number.parseInt(Env.get('TIMEZONE_OFFSET_HOURS', '0'), 10);
    const horas = Number.isNaN(offset) ? 0 : offset;
    preventivo.createdAt = DateTime.now().minus({ hours: horas });
  }
}
