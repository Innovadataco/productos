import { Exception } from '@adonisjs/core/build/standalone'
import type { ResponseContract } from '@ioc:Adonis/Core/Response'

export function manejarErrorIntegracion (error: any, response: ResponseContract): any {
  if (error?.responseData) {
    return response.status(error.status || 500).send(error.responseData)
  }

  if (error?.status === 401 || error?.message?.includes('Su sesión ha expirado')) {
    return response.status(401).send({
      mensaje: error.message || 'Su sesión ha expirado. Por favor, vuelva a iniciar sesión',
    })
  }

  if (error?.status === 400 || error?.message?.includes('Token de autorización no encontrado')) {
    return response.status(400).send({
      mensaje: error.message || 'Datos de autorización inválidos',
    })
  }

  if (error?.status === 404 || error?.message?.includes('no encontrado')) {
    return response.status(404).send({
      mensaje: error.message || 'Recurso no encontrado',
    })
  }

  if (error instanceof Exception) {
    return response.status(error.status || 500).send({
      mensaje: error.message || 'Error en la integración externa',
    })
  }

  return response.status(500).send({ mensaje: 'Error interno del servidor' })
}

export async function obtenerCredencialesJwt (request: any): Promise<{ documento: string, idRol: number }> {
  const payload = await request.obtenerPayloadJWT()
  const documento = payload?.documento || ''
  const idRol = payload?.idRol

  if (!documento || typeof idRol !== 'number') {
    throw new Exception('Datos de autenticación incompletos', 401)
  }

  return { documento, idRol }
}
