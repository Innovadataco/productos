import { RegistroBloqueo } from "../Datos/Entidades/Usuarios/RegistroBloqueo";

export interface RepositorioBloqueoUsuario{
    crearRegistro(registro:RegistroBloqueo):Promise<RegistroBloqueo>
    actualizarRegistro(registro:RegistroBloqueo):Promise<RegistroBloqueo>
    obtenerRegistroPorUsuario(identificacion:string):Promise<RegistroBloqueo | null>
}