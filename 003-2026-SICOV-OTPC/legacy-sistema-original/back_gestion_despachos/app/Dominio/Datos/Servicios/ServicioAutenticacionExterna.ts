import Env from '@ioc:Adonis/Core/Env'
import { ClienteHttp } from 'App/Dominio/ClienteHttp'
import { ClienteHttpAxios } from 'App/Infraestructura/ClientesHttp/ClienteHttpAxios'

interface RespuestaInicioSesionExterna {
  usuario: {
    id: number
    usuario: string
    nombre: string
    apellido: string | null
    telefono: string | null
    correo: string | null
  }
  token: string
  rol?: any
  claveTemporal?: boolean
  aplicativos?: any[]
}

export class ServicioAutenticacionExterna {
  constructor(private http: ClienteHttp = new ClienteHttpAxios()) {}

  public async iniciarSesionConEnv(): Promise<string> {
    const url = Env.get('EXTERNAL_APP_LOGIN_URL')
    const usuario = Env.get('EXTERNAL_APP_USER')
    const contrasena = Env.get('EXTERNAL_APP_PASSWORD')

    const body = { usuario, contrasena }

    const headers = { 'Content-Type': 'application/json' }

    const respuesta = await this.http.post<RespuestaInicioSesionExterna>(url, body, headers)

    if (!respuesta || !respuesta.token) {
      throw new Error('Respuesta inválida del servicio de autenticación externo')
    }

    return respuesta.token
  }
}
