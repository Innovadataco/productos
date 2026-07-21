export interface ClienteHttp {
    get<T>(url:string, cabeceras?:any):Promise<T>
    post<T>(url:string, cuerpo?:any, cabeceras?:any):Promise<T>
    patch<T>(url:string, cuerpo?:any, cabeceras?:any):Promise<T>
    put<T>(url:string, cuerpo?:any, cabeceras?:any):Promise<T>
    delete<T>(url:string, cabeceras?:any):Promise<T>
}