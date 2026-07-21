import { RepositorioProveedorVigilado } from "App/Dominio/Repositorios/RepositorioProveedorVigilado";

export class ServicioProveedorVigilado{
  constructor (private repositorio: RepositorioProveedorVigilado) { }

  async obtenerEmpresas (): Promise<any[]> {
    return this.repositorio.obtenerEmpresas();
  }

  async obtenerSeleccionadas (documento:string): Promise<any[]> {
    return this.repositorio.obtenerSeleccionadas(documento);
  }

  async asignar (documento:string, params:any): Promise<any> {
    return this.repositorio.asignar(documento, params);
  }

  async editar (documento:string, params:any): Promise<any> {
    return this.repositorio.editar(documento, params);
  }

  async activar (documento:string, params:any): Promise<any> {
    return this.repositorio.activar(documento, params);
  }

   async asignarProveedor (params:any): Promise<any[]> {
    return this.repositorio.asignarProveedor( params);
  }

}
