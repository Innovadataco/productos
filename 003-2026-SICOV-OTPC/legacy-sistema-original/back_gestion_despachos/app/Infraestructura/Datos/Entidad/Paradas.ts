import { BaseModel, belongsTo, BelongsTo, column} from '@ioc:Adonis/Lucid/Orm';
import { Parada } from 'App/Dominio/Datos/Entidades/Parada';
import { DateTime } from 'luxon';
import TblNodos from './Nodos';

export default class TblParadas extends BaseModel {

  @column({ isPrimary: true, columnName: 'tps_id' }) public id: number

  @column({ columnName: 'tps_codigo_cp' }) public codigoCp: string

  @column({ columnName: 'tps_nodo_id' }) public idNodo: number

  @column({ columnName: 'tps_via_id' }) public idVia: number

  @column.dateTime({ autoCreate: true , columnName: 'tps_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tps_actualizacion' }) public updatedAt: DateTime

  public establecerParada(parada: Parada) {
    this.codigoCp = parada.codigoCp!
    this.idNodo = parada.nodoId!
    this.idVia = parada.idVia!
  }

  public establecerParadaConId(parada: Parada) {
    this.codigoCp = parada.codigoCp!
    this.idNodo = parada.nodoId!
    this.idVia = parada.idVia!
  }

  @belongsTo (() => TblNodos, {
    localKey: 'id',
    foreignKey: 'idNodo',
  })
  public nodos: BelongsTo<typeof TblNodos>
}
