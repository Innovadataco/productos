import { BaseModel, BelongsTo, belongsTo, column, hasMany, HasMany, HasOne, hasOne} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import TblRutas from './Rutas';
import TblNodosDespachos from './NodosDespachos';
import TblRutaEmpresaVias from './RutaEmpresaVia';
import TblRutaHabilitadas from './RutaHabilitadas';
import { RutaCodigoRuta } from 'App/Dominio/Datos/Entidades/RutaCodigoRuta';
import TblRutaEmpresas from './RutaEmpresa';

export default class TblRutaCodigoRutas extends BaseModel {

  @column({ isPrimary: true, columnName: 'rcr_codigo_unico_ruta' }) public id: number

  @column({ columnName: 'rcr_codigo_ruta' }) public codigoRuta: number

  @column.dateTime({ autoCreate: true , columnName: 'rcr_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'rcr_actualizacion' }) public updatedAt: DateTime

  public establecerRutaCodigoRuta (rutaCodigoRuta: RutaCodigoRuta) {
    this.id = rutaCodigoRuta.id!
    this.codigoRuta = rutaCodigoRuta.codigoRuta!
  }

  @hasMany (() => TblRutas, {
    localKey: 'codigoRuta',
    foreignKey: 'codigoRuta',
  })
  public ruta: HasMany<typeof TblRutas>

  @hasOne (() => TblNodosDespachos, {
    localKey: 'id',
    foreignKey: 'idRuta',
  })
  public nodosDespacho: HasOne<typeof TblNodosDespachos>

  @hasMany (() => TblRutaEmpresaVias, {
    localKey: 'id',
    foreignKey: 'codigoRuta',
  })
  public rutaVias: HasMany<typeof TblRutaEmpresaVias>

  @hasOne (() => TblRutaHabilitadas, {
    localKey: 'id',
    foreignKey: 'idRuta',
  })
  public rutasHabilitada: HasOne<typeof TblRutaHabilitadas>

  @hasMany (() => TblRutaEmpresas, {
    localKey: 'id',
    foreignKey: 'idRuta',
    })
    public rutaEmpresa: HasMany<typeof TblRutaEmpresas>
}
