import { BaseModel, BelongsTo, belongsTo, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import { TblEstados } from './Estados';
import TblUsuarios from './Usuario';

export default class TblSolicitudes extends BaseModel {
  public static table = 'tbl_solicitudes';

  @column({ isPrimary: true, columnName: 'sol_id' })
  public id?: number

  @column({ columnName: 'sol_vigilado_id' })
  public vigiladoId: number;

  @column({ columnName: 'sol_verificador_id' })
  public verificadorId: string;

  @column({ columnName: 'sol_asignador_id' })
  public asignadorId: string;

  @column.dateTime({ columnName: 'sol_fecha_asignacion' })
  public fechaAsignacion: DateTime | null;

  @column({ columnName: 'sol_estado_vigilado' })
  public estado: number;

  @column.dateTime({ columnName: 'sol_fecha_eviost' })
  public fechaEnvioSt: DateTime;

  @column({ columnName: 'sol_estado_veri' })
  public estadoVeri: number | null;

  @column({ columnName: 'sol_asignada' })
  public asignada: boolean;

  @column.dateTime({ columnName: 'sol_fecha_eviost_veri' })
  public fechaEnvioStVeri: DateTime;

  @column.dateTime({ autoCreate: true, columnName: 'sol_creacion' })
  public creacion: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'sol_actualizacion' })
  public actualizacion: DateTime;



  @belongsTo(()=> TblEstados,{
    localKey: 'id',
    foreignKey: 'estado',
  })
  public estadosProveedor: BelongsTo<typeof TblEstados>

  @belongsTo(()=> TblEstados,{
    localKey: 'id',
    foreignKey: 'estadoVeri',
  })
  public estadosVerificador: BelongsTo<typeof TblEstados>

  @belongsTo(()=> TblUsuarios, {
    localKey: 'id',
    foreignKey: 'vigiladoId',
  })
  public vigilado: BelongsTo<typeof TblUsuarios>

  @belongsTo(()=> TblUsuarios, {
    localKey: 'identificacion',
    foreignKey: 'asignadorId',
  })
  public asignador: BelongsTo<typeof TblUsuarios>

  @belongsTo(()=> TblUsuarios, {
    localKey: 'identificacion',
    foreignKey: 'verificadorId',
  })
  public verificador: BelongsTo<typeof TblUsuarios>

}
