import { Exception } from '@adonisjs/core/build/standalone'
import Env from '@ioc:Adonis/Core/Env'
import axios, { AxiosRequestConfig } from 'axios'
import { TokenExterno } from 'App/Dominio/Utilidades/TokenExterno'
import { obtenerDatosAutenticacionUsuario } from 'App/Infraestructura/Implementacion/Lucid/AutenticacionUsuarioHelper'

export interface HeadersTransaccionales {
  Authorization: string
  token: string
  documento: string
  'Content-Type': string
  [clave: string]: string
}

export class ClienteApiSupertransporte {
  private static readonly TIMEOUT_INTEGRADORA_MS = 100000
  private static readonly TIMEOUT_TRANSACCIONAL_MS = 100000

  public static async obtenerHeadersTransaccionales (
    identificacion: string,
    idRol: number
  ): Promise<HeadersTransaccionales> {
    const tokenExterno = await TokenExterno.get()
    if (!tokenExterno || !TokenExterno.isVigente()) {
      throw new Exception('Su sesión ha expirado. Por favor, vuelva a iniciar sesión', 401)
    }

    const { tokenAutorizacion, nitVigilado } = await obtenerDatosAutenticacionUsuario(identificacion, idRol)

    return {
      Authorization: `Bearer ${tokenExterno}`,
      token: tokenAutorizacion,
      documento: nitVigilado,
      'Content-Type': 'application/json',
    }
  }

  public static obtenerHeadersParametricos (): Record<string, string> {
    const tokenParametrico = Env.get(
      'TOKEN_PARAMETRICO',
      'REDACTED-TOKEN-PARAMETRICO'
    )

    return {
      Authorization: `Bearer ${tokenParametrico}`,
      'Content-Type': 'application/json',
    }
  }

  public static async getTransaccional (
    url: string,
    identificacion: string,
    idRol: number,
    params?: Record<string, unknown>
  ): Promise<any> {
    const headers = await this.obtenerHeadersTransaccionales(identificacion, idRol)

    try {
      const respuesta = await axios.get(url, {
        headers,
        params,
        timeout: this.TIMEOUT_TRANSACCIONAL_MS,
      })
      return respuesta.data
    } catch (error) {
      throw this.toException(error)
    }
  }

  public static async postTransaccional (
    url: string,
    body: unknown,
    identificacion: string,
    idRol: number,
    config?: Pick<AxiosRequestConfig, 'timeout'>
  ): Promise<any> {
    const headers = await this.obtenerHeadersTransaccionales(identificacion, idRol)
console.log({
  url,
  body,
  headers,
})
    try {
      const respuesta = await axios.post(url, body, {
        headers,
        timeout: config?.timeout ?? this.TIMEOUT_TRANSACCIONAL_MS,
      })
      return respuesta.data
    } catch (error) {
      throw this.toException(error)
    }
  }

  public static async getParametrico (url: string, params?: Record<string, unknown>): Promise<any> {
    try {
      const respuesta = await axios.get(url, {
        headers: this.obtenerHeadersParametricos(),
        params,
        timeout: this.TIMEOUT_TRANSACCIONAL_MS,
      })
      return respuesta.data
    } catch (error) {
      throw this.toException(error)
    }
  }

  public static obtenerHeadersTokenEstatico (): Record<string, string> {
    return {
      Authorization: `Bearer ${Env.get('TOKEN')}`,
      'Content-Type': 'application/json',
    }
  }

  public static async getConTokenEstatico (url: string, params?: Record<string, unknown>): Promise<any> {
    try {
      const respuesta = await axios.get(url, {
        headers: this.obtenerHeadersTokenEstatico(),
        params,
        timeout: this.TIMEOUT_TRANSACCIONAL_MS,
      })
      return respuesta.data
    } catch (error) {
      throw this.toException(error)
    }
  }

  public static async postIntegradora (
    body: Record<string, unknown>,
    identificacion: string,
    idRol: number
  ): Promise<any> {
    const baseUrl = Env.get('URL_INTEGRADORA')
    const url = `${baseUrl}/api-integradora/resumen`
    const timeout = Number(Env.get('TIMEOUT_INTEGRADORA_MS', this.TIMEOUT_INTEGRADORA_MS))

    return this.postTransaccional(url, body, identificacion, idRol, {
      timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : this.TIMEOUT_INTEGRADORA_MS,
    })
  }

  public static extraerIdDespachoExterno (respuesta: any): number | null {
    const candidatos = [
      respuesta?.obj?.obj?.id,
      respuesta?.obj?.id,
      respuesta?.data?.id,
      respuesta?.id,
    ]

    return this.extraerIdNumerico(candidatos)
  }

  public static extraerIdLlegadaExterno (respuesta: any): number | null {
    const candidatos = [
      respuesta?.obj?.obj?.id,
      respuesta?.obj?.id,
      respuesta?.obj?.idLlegada,
      respuesta?.data?.idLlegada,
      respuesta?.data?.id,
      respuesta?.idLlegada,
      respuesta?.id,
    ]

    return this.extraerIdNumerico(candidatos)
  }

  public static limpiarPlaca (placa: string): string {
    return String(placa).replace(/[\s-]/g, '').toUpperCase()
  }

  private static extraerIdNumerico (candidatos: unknown[]): number | null {
    for (const valor of candidatos) {
      const numero = Number(valor)
      if (Number.isFinite(numero) && numero > 0) {
        return numero
      }
    }

    return null
  }

  public static toException (error: any): Exception {
    const exception = new Exception(
      error?.response?.data?.mensaje
        || error?.response?.data?.message
        || error?.message
        || 'Error al comunicarse con el servicio externo',
      error?.response?.status || 500
    )

    if (error?.response?.data) {
      (exception as any).responseData = error.response.data
    }

    return exception
  }
}
