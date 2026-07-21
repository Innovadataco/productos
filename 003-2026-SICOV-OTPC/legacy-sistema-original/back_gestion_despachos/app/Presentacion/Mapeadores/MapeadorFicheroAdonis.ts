import { MultipartFileContract } from '@ioc:Adonis/Core/BodyParser'
import { Fichero } from 'App/Dominio/Ficheros/Fichero'
import { readFile } from 'fs/promises'

export class MapeadorFicheroAdonis {
    static async obtenerFichero(ficheroAdonis: MultipartFileContract):Promise<Fichero>{
        return {
            contenido: await readFile(`${ficheroAdonis.tmpPath}`),
            nombre: ficheroAdonis.clientName,
            tamano: ficheroAdonis.size,
            extension: ficheroAdonis.extname 
        }
    }
}