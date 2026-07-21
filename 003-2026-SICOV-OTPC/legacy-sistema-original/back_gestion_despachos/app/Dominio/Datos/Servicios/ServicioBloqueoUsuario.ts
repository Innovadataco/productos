import { RepositorioBloqueoUsuario } from "App/Dominio/Repositorios/RepositorioBloqueoUsuario";
import { RegistroBloqueo } from "../Entidades/Usuarios/RegistroBloqueo";

export class ServicioUsuarios{
    constructor (private repositorioBloqueo: RepositorioBloqueoUsuario){}

    public obtenerRegistroDeBloqueo(identificacion:string):Promise<RegistroBloqueo | null>{
        return this.repositorioBloqueo.obtenerRegistroPorUsuario(identificacion)
    }

    public crearRegistroDeBloqueo(registroDeBloqueo:RegistroBloqueo):Promise<RegistroBloqueo>{
        return this.repositorioBloqueo.crearRegistro(registroDeBloqueo)
    }

    public actualizarRegistroDeBloqueo(registroDeBloqueo:RegistroBloqueo):Promise<RegistroBloqueo>{
        return this.repositorioBloqueo.actualizarRegistro(registroDeBloqueo)
    }
}