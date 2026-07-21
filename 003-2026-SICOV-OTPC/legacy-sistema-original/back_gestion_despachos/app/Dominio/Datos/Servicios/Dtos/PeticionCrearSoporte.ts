import { Fichero } from "App/Dominio/Ficheros/Fichero"

export interface PeticionCrearSoporte{
    documentoUsuario: string
    descripcion: string
    //parametros opcionales
    motivo?: number
    errorAcceso?: string
    adjunto?: Fichero
    telefono?: string
    correo?: string
    razonSocial?: string
}