export interface RepositorioNovedadesvehiculo{
    Listar(obj_filter:any):Promise<any>
    Crear(data:any, usuario:string, idRol:number):Promise<any>
    Edita(data:any):Promise<any>
    Desactivar(id:number):Promise<any>
    validarVehiculo(id:number):Promise<any>
}
