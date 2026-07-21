import { BaseModel, column, beforeCreate } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import Env from '@ioc:Adonis/Core/Env';

export default class TblCorrectivo extends BaseModel {

  @column({ isPrimary: true, columnName: 'tcv_id' }) public id?: number

  @column({ columnName: 'tcv_placa' }) public placa: string
  @column({ columnName: 'tcv_fecha' }) public fecha: Date
  @column({ columnName: 'tcv_hora' }) public hora: string
  @column({ columnName: 'tcv_nit' }) public nit: string
  @column({ columnName: 'tcv_razon_social' }) public razonSocial: string
  @column({ columnName: 'tcv_tipo_identificacion' }) public tipoIdentificacion: number
  @column({ columnName: 'tcv_numero_identificacion' }) public numeroIdentificacion: number
  @column({ columnName: 'tcv_nombres_responsable' }) public nombresResponsable: string
  @column({ columnName: 'tcv_mantenimiento_id' }) public mantenimientoId: number
  @column({ columnName: 'tcv_detalle_actividades' }) public detalleActividades: string

  @column({ columnName: 'tcv_estado' }) public estado?: boolean
  @column({ columnName: 'tcv_procesado' }) public procesado?: boolean
  @column.dateTime({ autoCreate: true , columnName: 'tcv_creado'}) public createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tcv_actualizado' }) public updatedAt: DateTime

  @beforeCreate()
  public static ajustarFechaCreacion(correctivo: TblCorrectivo) {
    const offset = Number.parseInt(Env.get('TIMEZONE_OFFSET_HOURS', '0'), 10);
    const horas = Number.isNaN(offset) ? 0 : offset;
    correctivo.createdAt = DateTime.now().minus({ hours: horas });
  }
}
