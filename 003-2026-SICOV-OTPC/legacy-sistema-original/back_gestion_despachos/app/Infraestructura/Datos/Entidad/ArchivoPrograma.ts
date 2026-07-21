import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';

export default class TblArchivoPrograma extends BaseModel {

  @column({ isPrimary: true, columnName: 'tap_id' }) public id: number

  @column({ columnName: 'tap_nombre_original' }) public nombreOriginal: string
  @column({ columnName: 'tap_documento' }) public documento: string
  @column({ columnName: 'tap_ruta' }) public ruta: string
  @column({ columnName: 'tap_tipo_id' }) public tipoId: number
  @column({ columnName: 'tap_usuario_id' }) public usuarioId: number

  @column({ columnName: 'tap_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true , columnName: 'tap_creado'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tap_actualizado' }) public updatedAt: DateTime
}
