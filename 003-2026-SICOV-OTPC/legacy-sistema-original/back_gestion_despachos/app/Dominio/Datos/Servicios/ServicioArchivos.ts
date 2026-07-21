import { ClienteHttp } from "App/Dominio/ClienteHttp";
import { Fichero } from "App/Dominio/Ficheros/Fichero";
import FormData from "form-data";
import Env from "@ioc:Adonis/Core/Env"
import { ArchivoGuardado } from "./Dtos/ArchivoGuardado";

export class ServicioArchivos{
    private readonly host = Env.get('URL_SERVICIO_ARCHIVOS')
    constructor(private http: ClienteHttp){}

    guardarArchivo(fichero: Fichero, ruta: string, idUsuario: string): Promise<ArchivoGuardado>{
        try {
            const endpoint = '/api/v1/archivos'
            const formData = new FormData()
            const nombreFichero = `${fichero.nombre}`
            formData.append('archivo', fichero.contenido, { filename: nombreFichero })
            formData.append('idVigilado', idUsuario)
            formData.append('rutaRaiz', ruta)
            return this.http.post<ArchivoGuardado>(`${this.host}${endpoint}`, formData, {  Authorization: `Bearer REDACTED-TOKEN-ARCHIVOS` })
        } catch (error) {
            console.log(error);
            throw error
        }
    }
}
