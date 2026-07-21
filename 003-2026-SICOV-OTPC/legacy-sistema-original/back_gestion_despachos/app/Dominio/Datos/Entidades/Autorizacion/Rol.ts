import { DateTime } from 'luxon'
import { Modulo } from './Modulo'

export class Rol {
  private _modulos:Modulo[] = []

  constructor (
    private _id: number,
    private _nombre: string,
    private _root: boolean = false,
    private _estado:boolean = true,
    private _creacion:DateTime = DateTime.now(),
    private _actualizacion:DateTime = DateTime.now()
  ){
  }

  public get id (){
    return this._id
  }

  public get nombre (){
    return this._nombre
  }

  public get modulos (){
    return this._modulos
  }

  public get root (){
    return this._root
  }

  public get estado (){
    return this._estado
  }

  public get creacion (){
    return this._creacion
  }

  public get actualizacion (){
    return this._actualizacion
  }

  public agregarModulo (modulo:Modulo):Rol{
    this._modulos.push(modulo)
    return this
  }
}
