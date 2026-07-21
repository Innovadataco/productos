import { DateTime } from 'luxon';
import { BaseModel, BelongsTo, HasMany, HasOne, ManyToMany, belongsTo, column, hasMany, hasOne, manyToMany} from '@ioc:Adonis/Lucid/Orm';
import { Usuario } from 'App/Dominio/Datos/Entidades/Usuario';
import TblRoles from './Autorizacion/Rol';
import TblRutaEmpresas from './RutaEmpresa';
import TblUsuariosModulos from './Autorizacion/UsuarioModulo';
import TblModulos from './Autorizacion/Modulo';


export default class TblUsuarios extends BaseModel {
  @column({ isPrimary: true, columnName: 'usn_id' })
  public id: number

  @column({ columnName: 'usn_nombre' }) public nombre: string

  @column({ columnName: 'usn_identificacion' }) public identificacion: string

  @column({ columnName: 'usn_usuario' }) public usuario: string

  @column({ columnName: 'usn_clave' }) public clave: string

  @column({ columnName: 'usn_estado' }) public estado: boolean

  @column({ columnName: 'usn_clave_temporal' }) public claveTemporal: boolean

  @column({ columnName: 'usn_telefono' }) public telefono: string

  @column({ columnName: 'usn_correo' }) public correo: string

  @column({ columnName: 'usn_token_autorizado' }) public tokenAutorizado: string

  @column({ columnName: 'usn_administrador' }) public administrador: string

  @column({ columnName: 'usn_rol_id' }) public idRol: number

  @column.dateTime({ autoCreate: true , columnName: 'usn_creacion'}) public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'usn_actualizacion' }) public updatedAt: DateTime

  public establecerUsuarioDb (usuario: Usuario) {
    this.id = usuario.id
    this.nombre = usuario.nombre
    this.usuario = usuario.usuario
    this.clave = usuario.clave
    this.claveTemporal = usuario.claveTemporal
    this.telefono = usuario.telefono
    this.correo = usuario.correo
    this.identificacion = usuario.identificacion
    this.estado = usuario.estado
    this.tokenAutorizado = usuario.tokenAutorizado
    this.idRol = usuario.idRol
    this.administrador = usuario.administrador
  }

  public estableceUsuarioConId (usuario: Usuario) {
    this.nombre = usuario.nombre
    this.usuario = usuario.usuario
    this.clave = usuario.clave
    this.claveTemporal = usuario.claveTemporal
    this.telefono = usuario.telefono
    this.correo = usuario.correo
    this.identificacion = usuario.identificacion
    this.estado = usuario.estado
    this.tokenAutorizado = usuario.tokenAutorizado
    this.administrador = usuario.administrador
    this.idRol = usuario.idRol
  }

  public obtenerUsuario (): Usuario {
    const usuario = new Usuario()
    usuario.id = this.id
    usuario.nombre = this.nombre
    usuario.usuario = this.usuario
    usuario.identificacion = this.identificacion
    usuario.correo = this.correo
    usuario.telefono = this.telefono
    usuario.idRol = this.idRol
    usuario.estado = this.estado
    usuario.clave = this.clave
    usuario.claveTemporal = this.claveTemporal
    // Incluir campos necesarios para validaciones de autenticación
    usuario.tokenAutorizado = this.tokenAutorizado
    usuario.administrador = this.administrador
    return usuario
  }

  @belongsTo(() => TblRoles, {
    localKey: 'id',
    foreignKey: 'idRol',
  })
  public rol: BelongsTo<typeof TblRoles>

  @hasMany(() => TblRutaEmpresas, {
    localKey: 'id',
    foreignKey: 'idUsuario',
  })
  public empresas: HasMany<typeof TblRutaEmpresas>

  @hasMany(() => TblUsuariosModulos, {
    localKey: 'id',
    foreignKey: 'usuarioId',
  })
  public usuariosModulos: HasMany<typeof TblUsuariosModulos>

  @manyToMany(() => TblModulos, {
    localKey: 'id',
    pivotForeignKey: 'usm_usuario_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'usm_modulo_id',
    pivotTable: 'tbl_usuarios_modulos',
  })
  public modulosPersonalizados: ManyToMany<typeof TblModulos>

}
