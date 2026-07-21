import { column, HasOne, hasOne, HasMany, hasMany, BaseModel } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';


export default class TblDespacho extends BaseModel {
  public static table = 'tbl_despachos'

  public static readonly createdAtColumn = 'des_fecha_creacion'
  public static readonly updatedAtColumn = 'des_fecha_actualizacion'

  @column({ isPrimary: true, columnName: 'des_id' }) public id: number
  @column({ columnName: 'des_id_despacho_terminal' }) public idDespachoTerminal: number
  @column({ columnName: 'des_terminal_despacho' }) public terminalDespacho: string
  @column({ columnName: 'des_nit_empresa_transporte' }) public nitEmpresaTransporte: string
  @column({ columnName: 'des_razon_social' }) public razonSocial: string
  @column({ columnName: 'des_numero_pasajero' }) public numeroPasajero: number
  @column({ columnName: 'des_valor_tiquete' }) public valorTiquete: number
  @column({ columnName: 'des_valor_total_tasa_uso' }) public valorTotalTasaUso: number
  @column({ columnName: 'des_valor_prueba_alcoholimetria' }) public valorPruebaAlcoholimetria: number
  @column({ columnName: 'des_tipo_despacho' }) public tipoDespacho: number
  @column({ columnName: 'des_observaciones' }) public observaciones: string
  @column({ columnName: 'des_fuente' }) public fuenteDato: string
  @column({ columnName: 'des_nit_proveedor' }) public nitProveedor: string
  @column({ columnName: 'des_sede' }) public sede: number
  @column({ columnName: 'des_estado' }) public estado: boolean
  @column({ columnName: 'des_despacho_en_transito' }) public despachoEnTransito: boolean
  @column.date({
    columnName: 'des_fecha_salida',
    serialize: (value: DateTime | null) => {
      return value && value.isValid ? value.toISODate() : value
    }
  })
  public fechaSalida: DateTime

  @column({ columnName: 'des_hora_salida' }) public horaSalida: string
  @column.dateTime({ columnName: 'des_fecha_creacion', autoCreate: true }) public fechaCreacion: DateTime
  @column.dateTime({ columnName: 'des_fecha_actualizacion', autoCreate: true, autoUpdate: true }) public fechaActualizacion: DateTime


}
