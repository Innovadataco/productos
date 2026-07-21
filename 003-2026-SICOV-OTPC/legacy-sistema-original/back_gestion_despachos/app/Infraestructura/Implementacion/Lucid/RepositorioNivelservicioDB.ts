import { Exception } from '@adonisjs/core/build/standalone'
import { RepositorioNivelservicio } from 'App/Dominio/Repositorios/RepositorioNivelservicio';
import TblLlegada from 'App/Infraestructura/Datos/Entidad/NivelServicios';
import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';
import { TokenExterno } from 'App/Dominio/Utilidades/TokenExterno';

export class RepositorioNivelservicioDB implements RepositorioNivelservicio {
  private async obtenerTokenExterno(): Promise<string> {
    const tokenExterno = await TokenExterno.get();
    if (!tokenExterno || !TokenExterno.isVigente()) {
      throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
    }
    return tokenExterno;
  }

  async Listar(obj_filter:any, token: string, documento: string):Promise<any>{
    const tokenExterno = await this.obtenerTokenExterno();

    try {
      const URL_DESPACHOS = Env.get('URL_DESPACHOS');
      const url = `${URL_DESPACHOS}/nivelservicio`;

      const respuesta = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${tokenExterno}`,
          'token': token,
          'Content-Type': 'application/json'
        }
      });

      return respuesta.data;
    } catch (errorExterno: any) {
      const statusCode = errorExterno.response?.status || 500;
      const mensajeError = errorExterno.response?.data?.mensaje ||
                          errorExterno.response?.data?.message ||
                          'Error al listar niveles de servicio';

      const exception = new Exception(mensajeError, statusCode);

      if (errorExterno.response?.data) {
        (exception as any).responseData = errorExterno.response.data;
      }

      throw exception;
    }
  }
}
