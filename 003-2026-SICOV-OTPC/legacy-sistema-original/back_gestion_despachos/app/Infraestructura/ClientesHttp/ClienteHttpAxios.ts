import { ClienteHttp } from "App/Dominio/ClienteHttp";
import axios from 'axios'

export class ClienteHttpAxios implements ClienteHttp {
    public async get<T>(url: string, cabeceras?:any): Promise<T> {
        return (await axios.get<T>(url, {headers: cabeceras})).data
    }
    public async post<T>(url: string, cuerpo?: any, cabeceras?:any): Promise<T> {
        return (await axios.post<T>(url, cuerpo, {headers: cabeceras})).data
    }
    public async patch<T>(url: string, cuerpo?: any, cabeceras?:any): Promise<T> {
        return (await axios.patch<T>(url, cuerpo, {headers: cabeceras})).data
    }
    public async put<T>(url: string, cuerpo?:any, cabeceras?:any): Promise<T> {
        return (await axios.put<T>(url, cuerpo, {headers: cabeceras})).data
    }
    public async delete<T>(url: string, cabeceras?:any): Promise<T> {
        return (await axios.delete<T>(url, {headers: cabeceras})).data
    }
    
}