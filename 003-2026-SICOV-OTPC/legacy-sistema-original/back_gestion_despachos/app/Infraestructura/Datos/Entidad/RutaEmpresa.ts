import { BaseModel, column, HasOne, hasOne} from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import TblRutaCodigoRutas from './RutaCodigoRutas';
import { RutaEmpresa } from 'App/Dominio/Datos/Entidades/RutaEmpresa';
import TblUsuarios from './Usuario';

export default class TblRutaEmpresas extends BaseModel {

  @column({ isPrimary: true, columnName: 'tre_id' }) public id: number

  @column({ columnName: 'tre_id_usuario' }) public idUsuario: number

  @column({ columnName: 'tre_codigo_unico_ruta' }) public idRuta: number

  @column({ columnName: 'tre_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true , columnName: 'tre_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'tre_actualizacion' }) public updatedAt: DateTime

  public establecerRutaEmpresa (rutaEmpresa: RutaEmpresa) {
    this.idUsuario = rutaEmpresa.idUsuario!
    this.idRuta = rutaEmpresa.idRuta!
  }

  public establecerRutaEmpresaConId (rutaEmpresa: RutaEmpresa) {
    this.idUsuario = rutaEmpresa.idUsuario!
    this.idRuta = rutaEmpresa.idRuta!
    this.estado = rutaEmpresa.estado!
  }

  @hasOne (() => TblRutaCodigoRutas, {
    localKey: 'idRuta',
    foreignKey: 'id',
  })
  public codigoUnicoRuta: HasOne<typeof TblRutaCodigoRutas>

  @hasOne (() => TblUsuarios, {
    localKey: 'idUsuario',
    foreignKey: 'id',
  })
  public usuarios: HasOne<typeof TblUsuarios>
}

