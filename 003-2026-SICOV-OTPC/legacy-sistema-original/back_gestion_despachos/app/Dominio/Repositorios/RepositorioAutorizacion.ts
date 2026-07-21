import { Rol } from "../Datos/Entidades/Autorizacion/Rol";

export interface RepositorioAutorizacion {
    obtenerRolConModulosYPermisos(idRol: number): Promise<Rol>
}
