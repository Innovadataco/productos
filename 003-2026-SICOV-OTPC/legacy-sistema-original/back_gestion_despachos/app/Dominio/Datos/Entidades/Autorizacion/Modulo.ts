import { DateTime } from 'luxon'
import { Submodulo } from './Submodulo'

export class Modulo {
  private _submodulos:Submodulo[] = []

  constructor (
    private _id: number,
    private _nombre: string,
    private _nombreMostrar: string,
    private _ruta: string,
    private _icono: string,
    private _estado: boolean = true,
    private _creacion: DateTime = DateTime.now(),
    private _actualizacion:DateTime = DateTime.now(),
  ){}

  public get id (){
    return this._id
  }

  public get submodulos (){
    return this._submodulos
  }

  public get nombre (){
    return this._nombre
  }

  public get nombreMostrar (){
    return this._nombreMostrar
  }

  public get ruta (){
    return this._ruta
  }

  public get icono (){
    return this._icono
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

  public agregarSubmodulo (funcionalidad:Submodulo):Modulo{
    this._submodulos.push(funcionalidad)
    return this
  }
}
