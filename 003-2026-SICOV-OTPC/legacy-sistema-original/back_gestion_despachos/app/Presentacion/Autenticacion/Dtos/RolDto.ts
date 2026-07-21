import { Rol } from "App/Dominio/Datos/Entidades/Autorizacion/Rol";
import { ModuloDto } from "./ModuloDto";

export class RolDto{
    public nombre
    public id
    public modulos: ModuloDto[]
    
    constructor(rol: Rol){
        this.nombre = rol.nombre
        this.id = rol.id
        this.modulos = rol.modulos.map( modulo => new ModuloDto( modulo ))
    }
}