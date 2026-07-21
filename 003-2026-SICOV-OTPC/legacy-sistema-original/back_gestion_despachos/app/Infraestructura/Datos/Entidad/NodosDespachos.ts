import { BaseModel, BelongsTo, belongsTo, column} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import TblNodos from './Nodos';
import TblParadas from './Paradas';
import { NodoDespacho } from 'App/Dominio/Datos/Entidades/NodoDespacho';

export default class TblNodosDespachos extends BaseModel {

  @column({ isPrimary: true, columnName: 'tnd_id' }) public id: number

  @column({ columnName: 'tnd_codigo_unico_ruta' }) public idRuta: number

  @column({ columnName: 'tnd_codigo_nodo' }) public idNodo: number

  @column({ columnName: 'tnd_paradas_id' }) public idParada: number

  @column({ columnName: 'tnd_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true , columnName: 'tnd_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tnd_actualizacion' }) public updatedAt: DateTime

  public establecerNodoDespacho(nodoDespacho: NodoDespacho) {
    this.idRuta = nodoDespacho.codigoUnicoRuta!
    this.idNodo = nodoDespacho.idNodo!
    this.idParada = nodoDespacho.idParada!
    this.estado = nodoDespacho.estado!
  }

  public establecerNodoDespachoConId(nodoDespacho: NodoDespacho) {
    this.idRuta = nodoDespacho.codigoUnicoRuta!
    this.idNodo = nodoDespacho.idNodo!
    this.idParada = nodoDespacho.idParada!
    this.estado = nodoDespacho.estado!
  }

  @belongsTo (() => TblNodos, {
    localKey: 'id',
    foreignKey: 'idNodo',
  })
  public nodos: BelongsTo<typeof TblNodos>

  @belongsTo (() => TblParadas, {
    localKey: 'id',
    foreignKey: 'idParada',
  })
  public paradas: BelongsTo<typeof TblParadas>
}
