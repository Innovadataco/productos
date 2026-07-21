import { DateTime } from "luxon"

export interface ParametrosInstanciaSoporte {
    id?: number
    radicado?: string
    nit: string
    razonSocial: string
    email: string
    telefono?: string
    descripcion: string
    documento?: string // nombre original
    identificadorDocumento?: string //nombre en sistema de ficheros
    documentoRespuesta?: string // nombre original
    identificadorDocumentoRespuesta?: string //nombre en sistema de ficheros
    ruta: string
    usuarioRespuesta?: string
    motivo?: number
    idEstado: number // 1 abierto, 2 en revisión, 3 cerrado
    fechaCreacion: DateTime
    fechaRespuesta?: DateTime
    respuesta?: string
    errorAcceso?: string
    problemaAcceso: boolean
}