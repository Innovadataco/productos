import { ClienteApiSupertransporte } from 'App/Dominio/Utilidades/ClienteApiSupertransporte'

export class ServicioPuenteIntegradora {
  public async consultarResumen (
    body: Record<string, unknown>,
    identificacion: string,
    idRol: number
  ): Promise<any> {
    return ClienteApiSupertransporte.postIntegradora(body, identificacion, idRol)
  }
}
