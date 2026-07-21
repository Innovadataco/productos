
export interface RepositorioArchivoPrograma{
    guardar(nombreOriginal:string, documento:string, ruta:string, idRol:number, tipoId:number, usuario:string): Promise<any>
    listar(usuarioId:number, tipoId:number): Promise<any>
}
