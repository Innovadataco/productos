export interface RepositorioNivelservicio{
    Listar(obj_filter:any, token: string, documento: string):Promise<any>
}
