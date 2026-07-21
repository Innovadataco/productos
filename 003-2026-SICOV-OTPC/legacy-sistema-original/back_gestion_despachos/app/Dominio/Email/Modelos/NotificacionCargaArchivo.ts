import { DateTime } from "luxon"

export interface NotificacionCargaArchivo {
    fechaCargue: DateTime
    tipoArchivo: string
    nombreArchivo: string
    numeroRadicado: string
    resultado: string
    logo?:string
}