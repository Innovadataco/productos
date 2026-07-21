import { Submodulo } from "App/Dominio/Datos/Entidades/Autorizacion/Submodulo"

export class SubmoduloDto{
    public id: number
    public nombre: string
    public ruta: string

    constructor(submodulo: Submodulo){
        this.id = submodulo.id
        this.nombre = submodulo.nombre
        this.ruta = submodulo.ruta
    }
}
