import Env from '@ioc:Adonis/Core/Env'
import { ClienteApiSupertransporte } from 'App/Dominio/Utilidades/ClienteApiSupertransporte'

export class ServicioPuenteMaestras {
  public async listarNivelServicio (
    identificacion: string,
    idRol: number,
    page?: number,
    numeroItems?: number
  ): Promise<any> {
    const url = `${Env.get('URL_DESPACHOS')}/nivelservicio`
    const params: Record<string, unknown> = {}

    if (page !== undefined) params.page = page
    if (numeroItems !== undefined) params.numero_items = numeroItems

    return ClienteApiSupertransporte.getTransaccional(url, identificacion, idRol, params)
  }

  public async listarTipoIdentificaciones (): Promise<any> {
    const url = `${Env.get('URL_PARAMETRICAS')}/parametrica/listar-tipo-identificaciones`
    return ClienteApiSupertransporte.getParametrico(url)
  }

  public async listarClaseVehiculo (): Promise<any> {
    const url = `${Env.get('URL_PARAMETRICAS')}/parametrica/listar-clase-vehiculo`
    return ClienteApiSupertransporte.getParametrico(url)
  }

  public async listarCentrosPoblados (): Promise<any> {
    const url = `${Env.get('URL_PARAMETRICAS')}/parametrica/listar-centros-poblados`
    return ClienteApiSupertransporte.getParametrico(url)
  }

  public async listarRutasActivasEmpresa (
    nit: string,
    identificacion: string,
    idRol: number
  ): Promise<any> {
    const url = `${Env.get('URL_MATENIMIENTOS')}/maestras/rutas-activas-empresa`
    return ClienteApiSupertransporte.getTransaccional(url, identificacion, idRol, { nit })
  }

  public async listarAutorizaciones (
    nit: string,
    placa: string,
    fecha: string
  ): Promise<any> {
    const placaLimpia = placa.replace(/[\s-]/g, '').toUpperCase()
    // El endpoint de autorizaciones se autentica con el TOKEN estático (Bearer)
    // y vive en /api/v1 del backend de rutas (no en el /api/v2 transaccional).
    const baseRutas = String(Env.get('URL_MATENIMIENTOS', '')).replace(/\/api\/v\d+\/?$/, '/api/v1')
    const url = `${baseRutas}/maestras/autorizaciones`

    return ClienteApiSupertransporte.getConTokenEstatico(url, {
      nit,
      placa: placaLimpia,
      fecha,
    })
  }
}
