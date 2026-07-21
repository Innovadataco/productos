
import { BaseModel, BelongsTo, belongsTo, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import TblMunicipios from './Municipios';
import TblTerminales from './Terminales';

export default class TblCentroPoblados extends BaseModel {

  @column({ isPrimary: true, columnName: 'tcp_id' }) public id: number

  @column({ columnName: 'tcp_codigo_centro_poblado' }) public codigoCentroPoblado: number

  @column({ columnName: 'tcp_nombre' }) public nombre: string

  @column({ columnName: 'tcp_codigo_municipio' }) public codigoMunicipio: number

  @column({ columnName: 'terminal' }) public terminal: number

  @column.dateTime({ autoCreate: true , columnName: 'tcp_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tcp_actualizacion' }) public updatedAt: DateTime

  @belongsTo (() => TblMunicipios, {
    localKey: 'codigoMunicipio',
    foreignKey: 'codigoMunicipio',
  })
  public municipio: BelongsTo<typeof TblMunicipios>

  @belongsTo(() => TblTerminales, {
    foreignKey: 'terminal',
    localKey: 'nit',
  })
  public terminal_rel: BelongsTo<typeof TblTerminales>
}
