import { BaseModel, beforeCreate, beforeUpdate, column, HasMany, hasMany } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';


export default class TblNovedades extends BaseModel {
  public static table = 'tbl_novedades'
  @column({ isPrimary: true, columnName: 'nov_id' }) public id: number
  @column({ columnName: 'nov_id_despacho' }) public idDespacho: number
  @column({ columnName: 'nov_id_novedad' }) public idNovedad: number
  @column({ columnName: 'nov_tipo_novedad_id' }) public idTipoNovedad: number
  @column({ columnName: 'nov_descripcion' }) public descripcion: string
  @column({ columnName: 'nov_otros' }) public otros: string
  @column({ columnName: 'nov_estado' }) public estado: boolean
  @column.dateTime({ columnName: 'nov_fecha_creacion' }) public fechaCreacion: DateTime
  @column.dateTime({ columnName: 'nov_fecha_actualizacion' }) public fechaActualizacion: DateTime
  @column({ columnName: 'nov_hora_novedad' }) public horaNovedad: string
  @column({ columnName: 'nov_nit_proveedor' }) public nitProveedor: string
  @column({ columnName: 'nov_fuente' }) public fuenteDato: string
  @column({ columnName: 'nov_procesado' }) public procesado: boolean
  @column({ columnName: 'nov_usuario_id' }) public usuarioId: string
  @column.date({
    columnName: 'nov_fecha_novedad',
    serialize: (value: DateTime | null) => {
      return value && value.isValid ? value.toISODate() : null
    }
  })
  public fechaNovedad: DateTime

}
