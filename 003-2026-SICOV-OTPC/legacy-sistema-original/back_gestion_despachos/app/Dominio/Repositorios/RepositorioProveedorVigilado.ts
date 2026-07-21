export interface RepositorioProveedorVigilado{
    obtenerEmpresas(): Promise<any[]>
    obtenerSeleccionadas(documento: string): Promise<any[]>
    asignar(documento: string, params: any): Promise<any>
    editar(documento: string, params: any): Promise<any>
    activar(documento: string, params: any): Promise<any>
    asignarProveedor(params: any): Promise<any[]>
}
