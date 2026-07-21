import { BaseModel, belongsTo, BelongsTo, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import TblTipoDespachos from './TipoDespacho';
import { Nodo } from 'App/Dominio/Datos/Entidades/Nodo';

export default class TblNodos extends BaseModel {

  @column({ isPrimary: true, columnName: 'tnd_id' }) public id: number

  @column({ columnName: 'tnd_despacho_id' }) public idDespacho: number

  @column({ columnName: 'tnd_descripcion' }) public descripcion: string

  @column({ columnName: 'tnd_direccion' }) public direccion: string

  @column({ columnName: 'tnd_codigo_cp' }) public codigoCp: string

  @column({ columnName: 'tnd_estado' }) public estado: boolean

  @column({ columnName: 'tnd_nit' }) public nit?: number

  @column.dateTime({ autoCreate: true , columnName: 'tnd_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tnd_actualizacion' }) public updatedAt: DateTime


  public establecerNodoDb (nodo: Nodo) {
    this.id = nodo.id!
    this.idDespacho = nodo.despachoId!
    this.descripcion = nodo.descripcion!
    this.direccion = nodo.direccion!
    this.codigoCp = nodo.codigoCentroPoblado!
    this.estado = nodo.estado!
    this.nit = nodo.nit
  }

  @belongsTo (() => TblTipoDespachos, {
    localKey: 'id',
    foreignKey: 'idDespacho',
  })
  public tipoDespacho: BelongsTo<typeof TblTipoDespachos>
}
