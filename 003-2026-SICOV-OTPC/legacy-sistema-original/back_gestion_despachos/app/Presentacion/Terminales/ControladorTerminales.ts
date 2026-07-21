/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { ServicioTerminales } from 'App/Dominio/Datos/Servicios/ServicioTerminales'
import { RepositorioTerminalesDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioTerminalesDB'
import { guardarLogError } from 'App/Dominio/guardarLogError'

export default class ControladorTerminales {
  private service: ServicioTerminales
  constructor () {
    this.service = new ServicioTerminales(new RepositorioTerminalesDB())
  }

  public async visualizarParadasPorRuta({ response, request }: HttpContextContract) {
    try {

      const { id } = await request.obtenerPayloadJWT()
        const paradas = await this.service.visualizarParadasPorRuta(request.all(), id)
        return response.status(200).send(paradas);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarParadasPorRuta')
    }
  }


  public async visualizarClasesPorRuta({ response, request }: HttpContextContract) {
    try {
      const Clases = await this.service.visualizarClasesPorRuta(request.all())
      return response.status(200).send(Clases);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarClasesPorRuta')
      return response.badRequest(error.messages)
    }
  }

  public async numeroTotalRutasPorUsuario({ response, request }: HttpContextContract) {
    try {
      const { idUsuario } = request.all()
      if (idUsuario) {
        const totalRutas = await this.service.numeroTotalRutasPorUsuario(idUsuario)
        return response.status(200).send(totalRutas);
      } else {
        const { id } = await request.obtenerPayloadJWT()
        const totalRutas = await this.service.numeroTotalRutasPorUsuario(id)
        return response.status(200).send(totalRutas);
      }
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'numeroTotalRutasPorUsuario')
      return response.badRequest(error.messages)
    }
  }

  public async guardarDireccion({ response, request }: HttpContextContract) {
    try {
      const direccionIn: any = request.all()
      if (!direccionIn || Object.keys(direccionIn).length === 0) {
        return response.badRequest({ message: 'El objeto de dirección no puede estar vacío.' });
      }
      const camposRequeridos = ['despachoId', 'descripcion', 'codigoCentroPoblado'];
      const camposFaltantes = camposRequeridos.filter(field => !direccionIn[field]);
      if (camposFaltantes.length > 0) {
        return response.badRequest({ message: `Faltan campos requeridos: ${camposFaltantes.join(', ')}` });
      }
      const direccion = await this.service.guardarDireccion(direccionIn)
      return response.created(direccion)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarDireccion')
      return response.badRequest(error.messages)
    }
  }

  public async guardarRuta({ response, request }: HttpContextContract) {
    const { id } = await request.obtenerPayloadJWT()
    try {
      const rutadb = request.all()
      if (!rutadb || Object.keys(rutadb).length === 0) {
        return response.badRequest({ message: 'La ruta no puede estar vacío.' });
      }
      const camposRequeridos = ['centroPobladoOrigen', 'centroPobladoDestino', 'direccion'];
      const camposFaltantes = camposRequeridos.filter(field => !rutadb[field]);
      if (camposFaltantes.length > 0) {
        return response.badRequest({ message: `Faltan campos requeridos: ${camposFaltantes.join(', ')}` });
      }
      const ruta = await this.service.guardarRuta(rutadb, id)
      return response.status(200).send(ruta);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarRuta')
      return response.badRequest(error.messages)
    }
  }

  public async guardarParada({ response, request }: HttpContextContract) {
    try {
      const paradadb = request.all()
      if (!paradadb || Object.keys(paradadb).length === 0) {
        return response.badRequest({ message: 'La parada no puede estar vacío.' });
      }
      const camposRequeridos = ['idRuta', 'centroPobladoId', 'direccionId'];
      const camposFaltantes = camposRequeridos.filter(field => !paradadb[field]);
      if (camposFaltantes.length > 0) {
        return response.badRequest({ message: `Faltan campos requeridos: ${camposFaltantes.join(', ')}` });
      }
      const ruta = await this.service.guardarParada(paradadb)
      return response.status(200).send(ruta);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarParada')
      return response.badRequest(error.messages)
    }
  }

  public async guardarClase({ response, request }: HttpContextContract) {
    try {
      const clasedb = request.all()
      if (!clasedb || Object.keys(clasedb).length === 0) {
        return response.badRequest({ message: 'La clase no puede estar vacío.' });
      }
      const camposRequeridos = ['idRuta', 'idClaseVehiculo', 'estado'];
      const camposFaltantes = camposRequeridos.filter(field => !clasedb[field]);
      if (camposFaltantes.length > 0) {
        return response.badRequest({ message: `Faltan campos requeridos: ${camposFaltantes.join(', ')}` });
      }
      const ruta = await this.service.guardarClase(clasedb)
      return response.status(200).send(ruta);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarClase')
      return response.badRequest(error.messages)
    }
    }

  public async guardar({ response, request }: HttpContextContract) {
    const { id } = await request.obtenerPayloadJWT()
    try {
      const RutaInfo = request.all()
      const rutas = await this.service.guardar(RutaInfo, id)
      return response.status(200).send(rutas);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarTerminal')
      return response.badRequest(error.messages)
    }
  }

  public async enviarSt({ response, request }: HttpContextContract) {
    try {
      const arregloSt = request.all()
      const respuestast = await this.service.enviarSt(arregloSt)
      return response.status(200).send(respuestast);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'enviarSTTerminal')
      return response.badRequest(error.messages)
    }
  }

  public async visualizarRutasVigilado({ response, request }: HttpContextContract) {
    try {
      const rutasVigilado = await this.service.visualizarRutasVigilado(request.all())
      return response.status(200).send(rutasVigilado);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarRutasVigilado')
      return response.badRequest(error.messages)
    }
  }

  public async visualizarRuta({ response, request }: HttpContextContract) {
    try {
      const rutaVigilado = await this.service.visualizarRuta(request.all())
      return response.status(200).send(rutaVigilado);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarRuta')
      return response.badRequest(error.messages)
    }
  }

  public async eliminarClase({ response, request }: HttpContextContract) {
    try {
      const {claseId} = request.all()
      const clase = await this.service.eliminarClase(claseId)
      return response.status(200).send(clase);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'eliminarClase')
      return response.badRequest(error.messages)
    }
  }

  public async eliminarParada({ response, request }: HttpContextContract) {
    try {
      const parada = await this.service.eliminarParada(request.all())
      return response.status(200).send(parada);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'eliminarParada')
      return response.badRequest(error.messages)
    }
  }

  public async eliminarVia({ response, request }: HttpContextContract) {
    try {
      const parada = await this.service.eliminarVia(request.all())
      return response.status(200).send(parada);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'eliminarVia')
      return response.badRequest(error.messages)
    }
  }

  public async guardarVia({ response, request }: HttpContextContract) {
    try {
      const via = await this.service.guardarVia(request.all())
      return response.status(200).send(via);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarVia')
      return response.badRequest(error.messages)
    }
  }

  public async eliminarRuta({ response, request }: HttpContextContract) {
    try {
      const rutas = await this.service.eliminarRuta(request.all())
      return response.status(200).send(rutas);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'eliminarRuta')
      return response.badRequest(error.messages)
    }
  }


}
