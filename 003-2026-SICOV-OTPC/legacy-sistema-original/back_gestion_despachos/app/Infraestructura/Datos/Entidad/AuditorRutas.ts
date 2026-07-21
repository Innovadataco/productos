
import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblAuditorRutas extends BaseModel {

  @column({ isPrimary: true, columnName: 'tar_id' }) public id: number

  @column({ columnName: 'tar_usuario_id' }) public idUsuario: number

  @column({ columnName: 'tar_ruta_id' }) public idRuta: number

  @column({ columnName: 'tar_habilitada' }) public habilitada: boolean

  @column({ columnName: 'tar_observacion' }) public observacion: string

  @column.dateTime({ autoCreate: true , columnName: 'tar_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tar_actualizacion' }) public updatedAt: DateTime
}
