import { BaseModel, column, HasOne, hasOne, beforeCreate } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import TblAutorizaciones from './Autorizaciones';
import Env from '@ioc:Adonis/Core/Env';

export default class TblMantenimiento extends BaseModel {

  @column({ isPrimary: true, columnName: 'tmt_id' }) public id?: number

  @column({ columnName: 'tmt_placa' }) public placa: string
  @column.dateTime({autoCreate: true , columnName: 'tmt_fecha_diligenciamiento' }) public fechaDiligenciamiento: DateTime
  @column({ columnName: 'tmt_tipo_id' }) public tipoId: number
  @column({ columnName: 'tmt_usuario_id' }) public usuarioId: number
  @column({ columnName: 'tmt_estado' }) public estado: boolean | null
  @column({ columnName: 'tmt_procesado' }) public procesado: boolean | null
  @column({ columnName: 'tmt_mantenimiento_id' }) public mantenimientoId: number | null
  @column.dateTime({ autoCreate: true , columnName: 'tmt_creado'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tmt_actualizado' }) public updatedAt: DateTime

  @hasOne(() => TblAutorizaciones,{
    localKey: 'id',
    foreignKey: 'mantenimientoId',
  })
  public autorizacion:HasOne<typeof TblAutorizaciones>

  @beforeCreate()
  public static ajustarFechaCreacion(mantenimiento: TblMantenimiento) {
    const offset = Number.parseInt(Env.get('TIMEZONE_OFFSET_HOURS', '0'), 10);
    const horas = Number.isNaN(offset) ? 0 : offset;
    mantenimiento.createdAt = DateTime.now().minus({ hours: horas });
  }

}
