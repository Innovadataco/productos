import { BaseModel, BelongsTo, belongsTo, column} from '@ioc:Adonis/Lucid/Orm';
import { ClaseVehiculo } from 'App/Dominio/Datos/Entidades/ClaseVehiculo';
import { DateTime } from 'luxon';
import TblClaseVehiculos from './ClaseVehiculos';
import TblRutaCodigoRutas from './RutaCodigoRutas';

export default class TblRutaVehiculos extends BaseModel {

  @column({ isPrimary: true, columnName: 'trv_id' }) public id: number

  @column({ columnName: 'trv_codigo_unico_ruta' }) public idRuta: number

  @column({ columnName: 'trv_clase_vehiculo_id' }) public idClaseVehiculo: number

  @column({ columnName: 'trv_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true , columnName: 'trv_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'trv_actualizacion' }) public updatedAt: DateTime

  public establecerRutaVehiculo(rutaVehiculo: ClaseVehiculo) {
    this.idRuta = rutaVehiculo.idRuta!
    this.idClaseVehiculo = rutaVehiculo.idClaseVehiculo!
    this.estado = rutaVehiculo.estado!
  }

  public establecerRutaVehiculoConId(rutaVehiculo: ClaseVehiculo) {
    this.idRuta = rutaVehiculo.idRuta!
    this.idClaseVehiculo = rutaVehiculo.idClaseVehiculo!
    this.estado = rutaVehiculo.estado!
  }

  @belongsTo (() => TblClaseVehiculos, {
    localKey: 'id',
    foreignKey: 'idClaseVehiculo',
  })
  public clasesVehiculos: BelongsTo<typeof TblClaseVehiculos>

  @belongsTo (() => TblRutaCodigoRutas, {
    localKey: 'id',
    foreignKey: 'idRuta',
  })
  public rutas: BelongsTo<typeof TblRutaCodigoRutas>
}
