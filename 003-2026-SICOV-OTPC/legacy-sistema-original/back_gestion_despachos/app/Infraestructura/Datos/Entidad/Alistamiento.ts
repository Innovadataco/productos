import { BaseModel, column, ManyToMany, manyToMany, beforeCreate } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import TblActividadesAlistamiento from './ActividadesAlistamiento';
import Env from '@ioc:Adonis/Core/Env';

export default class TblAlistamiento extends BaseModel {

  @column({ isPrimary: true, columnName: 'tba_id' }) public id: number

  @column({ columnName: 'tba_placa' }) public placa: string
  @column({ columnName: 'tba_tipo_identificacion_responsable' }) public tipoIdentificacionResponsable: number
  @column({ columnName: 'tba_numero_identificacion_responsable' }) public numeroIdentificacionResponsable: number
  @column({ columnName: 'tba_nombres_responsable' }) public nombreResponsable: string
  @column({ columnName: 'tba_tipo_identificacion_conductor' }) public tipoIdentificacionConductor: number
  @column({ columnName: 'tba_numero_identificacion_conductor' }) public numeroIdentificacionConductor: number
  @column({ columnName: 'tba_nombres_conductor' }) public nombresConductor: string
  @column({ columnName: 'tba_mantenimiento_id' }) public mantenimientoId: number
  @column({ columnName: 'tba_detalle_actividades' }) public detalleActividades: string

  @column({ columnName: 'tba_estado' }) public estado: boolean
   @column({ columnName: 'tba_procesado' }) public procesado?: boolean
  @column.dateTime({ autoCreate: true , columnName: 'tba_creado'}) public createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tba_actualizado' }) public updatedAt: DateTime

  @manyToMany(() => TblActividadesAlistamiento,{
    localKey: 'id',
    relatedKey:'id',
    pivotTable:'tbl_detalles_actividades_alistamientos',
    pivotForeignKey:'tda_alistamiento_id',
    pivotRelatedForeignKey:'tda_actividad_id',
    pivotColumns:['tda_estado']
  })
  public actividades :ManyToMany<typeof TblActividadesAlistamiento>

  @beforeCreate()
  public static ajustarFechaCreacion(alistamiento: TblAlistamiento) {
    const offset = Number.parseInt(Env.get('TIMEZONE_OFFSET_HOURS', '0'), 10);
    const horas = Number.isNaN(offset) ? 0 : offset;
    alistamiento.createdAt = DateTime.now().minus({ hours: horas });
  }
}
