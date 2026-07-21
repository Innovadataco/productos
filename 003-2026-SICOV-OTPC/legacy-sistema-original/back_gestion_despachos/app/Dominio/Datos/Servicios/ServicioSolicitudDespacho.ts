import { DateTime } from 'luxon'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { Exception } from '@adonisjs/core/build/standalone'
import { ClienteApiSupertransporte } from 'App/Dominio/Utilidades/ClienteApiSupertransporte'
import TblSolicitudDespacho, { EstadoSolicitudDespacho } from 'App/Infraestructura/Datos/Entidad/SolicitudDespacho'
import { obtenerDatosAutenticacionUsuario } from 'App/Infraestructura/Implementacion/Lucid/AutenticacionUsuarioHelper'
import DespachosQueueService from 'App/Servicios/DespachosQueueService'

export class ServicioSolicitudDespacho {
  private colaDespachos = new DespachosQueueService()

  /**
   * El API externo exige varios campos como string. Se normalizan antes de persistir/enviar.
   */
  private convertirCamposAString (objeto: Record<string, unknown>, campos: string[]): void {
    for (const campo of campos) {
      if (objeto[campo] !== undefined && objeto[campo] !== null) {
        objeto[campo] = String(objeto[campo])
      }
    }
  }

  private normalizarPayload (payload: Record<string, unknown>): Record<string, unknown> {
    const objDespacho = payload?.obj_despacho
    if (objDespacho && typeof objDespacho === 'object') {
      this.convertirCamposAString(objDespacho as Record<string, unknown>, [
        'nitEmpresaTransporte',
        'razonSocial',
        'fechaSalida',
        'horaSalida',
        'observaciones',
        'nitProveedor',
      ])
    }

    const objVehiculo = payload?.obj_vehiculo
    if (objVehiculo && typeof objVehiculo === 'object') {
      const vehiculo = objVehiculo as Record<string, unknown>
      this.convertirCamposAString(vehiculo, [
        'placa',
        'soat',
        'fechaVencimientoSoat',
        'revisionTecnicoMecanica',
        'fechaRevisionTecnicoMecanica',
        'tarjetaOperacion',
        'fechaVencimientoTarjetaOperacion',
        'idMatenimientoPreventivo',
        'idProtocoloAlistamientodiario',
      ])

      if (vehiculo.placa) {
        vehiculo.placa = ClienteApiSupertransporte.limpiarPlaca(String(vehiculo.placa))
      }
    }

    const objConductores = payload?.obj_conductores
    if (objConductores && typeof objConductores === 'object') {
      this.convertirCamposAString(objConductores as Record<string, unknown>, [
        'numeroIdentificacion',
        'primerNombrePrincipal',
        'segundoNombrePrincipal',
        'primerApellidoPrincipal',
        'segundoApellidoPrincipal',
        'idExamenMedico',
        'idPruebaAlcoholimetria',
        'licenciaConduccion',
        'numeroIdentificacionSecundario',
        'primerNombreSecundario',
        'idExamenMedicoSecundario',
        'idPruebaAlcoholimetriaSecundario',
        'licenciaConduccionSecundario',
      ])
    }

    const objRutas = payload?.obj_rutas
    if (objRutas && typeof objRutas === 'object') {
      this.convertirCamposAString(objRutas as Record<string, unknown>, [
        'centroPobladoOrigen',
        'centroPobladoDestino',
      ])
    }

    return payload
  }

  public async registrar (
    payload: Record<string, unknown>,
    identificacion: string,
    idRol: number
  ): Promise<any> {
    payload = this.normalizarPayload(payload)
    const { nitVigilado } = await obtenerDatosAutenticacionUsuario(identificacion, idRol)

    const solicitud = await TblSolicitudDespacho.create({
      payload,
      nitVigilado,
      usuarioId: identificacion,
      rolId: idRol,
      fuenteDato: 'WEB',
      procesado: false,
      idDespachoExterno: null,
      respuestaExterna: null,
      errorExterno: null,
      estado: 'pendiente',
      reintentos: 0,
      siguienteIntento: DateTime.now(),
    })

    // Intenta enviar al externo en el mismo request y devuelve su respuesta tal cual.
    try {
      await this.colaDespachos.enviarSolicitud(solicitud)
      solicitud.estado = 'procesado'
      solicitud.siguienteIntento = DateTime.now()
      await solicitud.save()

      return {
        solicitudId: solicitud.id,
        ...(solicitud.respuestaExterna as Record<string, unknown> | null ?? {}),
      }
    } catch (error: any) {
      const statusCode = Number(error?.status) || 500
      const responseData = error?.responseData
      const mensajeError = JSON.stringify(responseData || error?.message || 'Error desconocido')
      const esErrorCliente = statusCode >= 400 && statusCode < 500

      solicitud.merge({
        estado: esErrorCliente ? 'fallido' : 'pendiente',
        errorExterno: mensajeError,
        siguienteIntento: esErrorCliente
          ? DateTime.now()
          : DateTime.now().plus({ minutes: 5 }),
      })
      await solicitud.save()

      Logger.error(
        'Error API externo POST /despachosempresa (solicitud %s): status=%s respuesta=%s',
        solicitud.id,
        statusCode,
        JSON.stringify(responseData ?? error?.message ?? 'sin detalle')
      )

      throw error
    }
  }

  public async obtenerSolicitud (id: number): Promise<TblSolicitudDespacho> {
    return TblSolicitudDespacho.findOrFail(id)
  }

  public async listarSolicitudes (estado?: EstadoSolicitudDespacho): Promise<TblSolicitudDespacho[]> {
    const consulta = TblSolicitudDespacho.query().orderBy('des_sol_id', 'desc')
    if (estado) {
      consulta.where('des_sol_estado', estado)
    }
    return consulta
  }

  public async reintentarSolicitud (id: number): Promise<TblSolicitudDespacho> {
    const solicitud = await TblSolicitudDespacho.find(id)
    if (!solicitud) {
      throw new Exception('Solicitud de despacho no encontrada', 404)
    }
    if (solicitud.procesado) {
      throw new Exception('La solicitud ya fue procesada exitosamente', 400)
    }

    solicitud.merge({
      estado: 'pendiente',
      reintentos: 0,
      errorExterno: null,
      siguienteIntento: DateTime.now(),
    })
    await solicitud.save()

    return solicitud
  }

  public async consultarPorPlaca (
    placa: string,
    identificacion: string,
    idRol: number,
    fechaSalida?: string
  ): Promise<any> {
    const placaLimpia = ClienteApiSupertransporte.limpiarPlaca(placa)
    const urlDespachos = Env.get('URL_DESPACHOS')
    let url = `${urlDespachos}/despachos/placa/${placaLimpia}`

    const params: Record<string, unknown> = {}
    if (fechaSalida && fechaSalida.trim() !== '') {
      params.fechaSalida = fechaSalida
    }

    return ClienteApiSupertransporte.getTransaccional(url, identificacion, idRol, params)
  }

  public async consultarPorNit (
    nit: string,
    identificacion: string,
    idRol: number
  ): Promise<any> {
    const urlDespachos = Env.get('URL_DESPACHOS')
    const url = `${urlDespachos}/despachos`

    const params: Record<string, unknown> = {}
    const nitLimpio = typeof nit === 'string' ? nit.trim() : ''
    if (nitLimpio !== '') {
      params.nit = nitLimpio
    }

    return ClienteApiSupertransporte.getTransaccional(url, identificacion, idRol, params)
  }

  public async consultarPorId (
    idDespacho: number,
    identificacion: string,
    idRol: number
  ): Promise<any> {
    const urlDespachos = Env.get('URL_DESPACHOS')
    const url = `${urlDespachos}/despachos/${idDespacho}`

    return ClienteApiSupertransporte.getTransaccional(url, identificacion, idRol)
  }
}
