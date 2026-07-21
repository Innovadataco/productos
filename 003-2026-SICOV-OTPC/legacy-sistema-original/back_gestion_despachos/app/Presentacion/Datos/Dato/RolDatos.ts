import { Modulo } from 'App/Dominio/Datos/Entidades/Autorizacion/Modulo'
import { DateTime } from 'luxon'

export class RolDatos {
  public id: number
  public nombre: string
  public estado: boolean = true
  public creacion: DateTime = DateTime.now()
  public actualizacion: DateTime = DateTime.now()
  public modulos:Modulo[] = []
}
