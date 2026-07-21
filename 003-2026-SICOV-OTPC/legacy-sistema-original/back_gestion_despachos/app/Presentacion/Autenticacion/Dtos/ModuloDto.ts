import { SubmoduloDto } from "./SubModuloDto"
import { Modulo } from "App/Dominio/Datos/Entidades/Autorizacion/Modulo"

export class ModuloDto{
    public id: number
    public nombre: string
    public ruta: string
    public submodulos: SubmoduloDto[]
    public icono:string

    constructor(modulo: Modulo){
        this.id = modulo.id
        this.nombre = modulo.nombreMostrar
        this.ruta = modulo.ruta
        this.submodulos = modulo.submodulos.map( submodulo => new SubmoduloDto(submodulo))
        this.icono = modulo.icono
    }
}
