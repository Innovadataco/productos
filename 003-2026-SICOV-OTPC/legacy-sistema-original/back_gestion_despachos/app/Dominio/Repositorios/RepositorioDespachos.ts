export interface RepositorioDespachos{
    Listar(documento: string, idRol: number, nit?: string):Promise<any>
    Listados(nit: string, page:number, numero_items:number):Promise<any>
    Crear(data:any):Promise<any>
    Edita(id:number, data:any):Promise<any>
    Desactivar(id:number):Promise<any>
    BuscarPorId(id:number, usuario: string, idRol: number):Promise<any>
    BuscarPorPlacaVehiculo(placa: string, usuario: string, idRol: number, fechaSalida?: string):Promise<any>
}
