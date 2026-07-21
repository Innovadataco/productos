/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/semi */
import { DateTime } from 'luxon';
import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { Rol } from 'App/Dominio/Datos/Entidades/Autorizacion/Rol';
export default class TblRoles extends BaseModel {
  public static readonly table = 'tbl_roles'

  @column({ isPrimary: true, columnName: 'rol_id' }) public id: number

  @column({ columnName: 'rol_nombre' }) public nombre: string

  @column({ columnName: 'rol_estado' }) public estado: boolean

  @column.dateTime({ autoCreate: true, columnName: 'rol_creado' }) public creacion: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'rol_actualizado' }) public actualizacion: DateTime

  public establecerRolTblRoles (rol:Rol):void{
    this.id = rol.id
    this.nombre = rol.nombre
    this.estado = rol.estado
    this.creacion = rol.creacion;
    this.actualizacion = rol.actualizacion;
  }

  public obtenerRol ():Rol{
    return new Rol(
      this.id,
      this.nombre,
      this.estado,
      false,
      this.creacion,
      this.actualizacion
    )
  }
}
