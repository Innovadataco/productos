import { Encriptador } from 'App/Dominio/Encriptacion/Encriptador'
import Hash from '@ioc:Adonis/Core/Hash'
import { Exception } from '@adonisjs/core/build/standalone'
import Logger from '@ioc:Adonis/Core/Logger'

export class EncriptadorAdonis implements Encriptador {
  public async encriptar (cadena: string): Promise<string> {
    return await Hash.make(cadena)
  }

  public async comparar (cadena: string, hash: string): Promise<boolean> {
    try {
      Logger.debug(`Iniciando verificación de hash. Hash length: ${hash ? hash.length : 0}`)
      const resultado = await Hash.verify(hash, cadena)
      Logger.debug(`Resultado verificación de hash: ${resultado}`)
      return resultado

    } catch (error) {
      Logger.error(`Error verificando hash: ${error instanceof Error ? error.message : 'error desconocido'}`)
      throw new Exception('Credenciales incorrectas, por favor intente recuperar contraseña con su correo', 400)
    }


  }
}
