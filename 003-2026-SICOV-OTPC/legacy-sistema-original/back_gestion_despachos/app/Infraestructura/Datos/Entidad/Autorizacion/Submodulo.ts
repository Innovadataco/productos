/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/semi */
import { DateTime } from 'luxon';
import { BaseModel, column} from '@ioc:Adonis/Lucid/Orm';
import { Submodulo } from 'App/Dominio/Datos/Entidades/Autorizacion/Submodulo';
export default class TblSubmodulos extends BaseModel {
  public static readonly table = 'tbl_submodulos'

  @column({ isPrimary: true, columnName: 'smod_id' }) public id: number

  @column({ columnName: 'smod_nombre' }) public nombre: string

  @column({ columnName: 'smod_nombre_mostrar' }) public nombreMostrar: string

  @column({ columnName: 'smod_ruta' }) public ruta: string

  @column({ columnName: 'smod_estado' }) public estado: boolean

  @column({ columnName: 'smod_modulo' }) public idModulo: string

  @column.dateTime({ autoCreate: true, columnName: 'smod_creado' }) public creacion: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'smod_actualizado' }) public actualizacion: DateTime

  public establecerSubmoduloDb (submodulo: Submodulo):void{
    this.id = submodulo.id
    this.nombre = submodulo.nombre
    this.nombreMostrar = submodulo.nombreMostrar
    this.idModulo = submodulo.idModulo
    this.estado = submodulo.estado
    this.creacion = submodulo.creacion;
    this.actualizacion = submodulo.actualizacion;
  }

  public obtenerSubmodulo(): Submodulo{
    return new Submodulo(
      this.id,
      this.nombre,
      this.idModulo,
      this.nombreMostrar,
      this.ruta,
      this.estado,
      this.creacion,
      this.actualizacion
    )
  }
}
