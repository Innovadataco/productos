import { Usuario } from '../Datos/Entidades/Usuario';
import { PayloadJWT } from '../Dto/PayloadJWT';
import { Paginador } from '../Paginador';

export interface RepositorioUsuario {
  obtenerUsuarios(param: any): Promise<{usuarios: Usuario[], paginacion: Paginador}>
  obtenerVigilados(param: any): Promise<{usuarios: Usuario[]}>
  obtenerTodosVigilados(param: any): Promise<{usuarios: Usuario[]}>
  obtenerUsuariosRol2(): Promise<{usuarios: Usuario[]}>
  obtenerUsuarioPorId(id: number): Promise<Usuario>
  obtenerUsuarioPorRol(rol: string): Promise<Usuario[]>
  guardarUsuario(usuario: Usuario): Promise<Usuario>
  actualizarUsuario(id: number, usuario: Usuario, payload?:PayloadJWT): Promise<Usuario>
  obtenerUsuarioPorUsuario(nombreUsuario: string): Promise<Usuario | null>
}
