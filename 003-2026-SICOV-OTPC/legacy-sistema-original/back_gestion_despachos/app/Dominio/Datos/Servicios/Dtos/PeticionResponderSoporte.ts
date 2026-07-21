import { Fichero } from "App/Dominio/Ficheros/Fichero"

export interface PeticionResponderSoporte{
    soporteId: number 
    respuesta: string 
    adjunto?: Fichero
    identificacionUsuarioAdmin: string
} 