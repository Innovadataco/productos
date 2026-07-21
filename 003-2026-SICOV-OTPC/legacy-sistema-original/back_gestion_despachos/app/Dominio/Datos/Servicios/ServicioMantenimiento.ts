import { OpcionesSincronizacion, RepositorioMantenimiento } from 'App/Dominio/Repositorios/RepositorioMantenimiento';
import type { Paginable, TrabajoProgramado } from 'App/Dominio/Tipos/Tipos';

export class ServicioMantenimeinto{
  constructor (private repositorio: RepositorioMantenimiento) { }

  async listarPlacas (tipoId:number, usuario:string, idRol:number): Promise<any[]>{
    return this.repositorio.listarPlacas(tipoId, usuario, idRol)
  }

  async listarPlacasTodas (tipoId:number, vigiladoId:string): Promise<any[]>{
    return this.repositorio.listarPlacasTodas(tipoId, vigiladoId)
  }
  async guardarMantenimiento (datos:any, usuario:string, idRol:number, proveedorId?:string, opciones?:OpcionesSincronizacion): Promise<any>{
    return this.repositorio.guardarMantenimiento(datos, usuario, idRol, proveedorId, opciones)
  }

  async guardarPreventivo (datos:any, usuario:string, idRol:number, opciones?:OpcionesSincronizacion): Promise<any>{
    return this.repositorio.guardarPreventivo(datos, usuario, idRol, opciones)
  }

  async guardarCorrectivo (datos:any, usuario:string, idRol:number, opciones?:OpcionesSincronizacion): Promise<any>{
    return this.repositorio.guardarCorrectivo(datos, usuario, idRol, opciones)
  }

  async guardarAlistamiento (datos:any, usuario:string, idRol:number, opciones?:OpcionesSincronizacion): Promise<any>{
    return this.repositorio.guardarAlistamiento(datos, usuario, idRol, opciones)
  }

  async visualizarPreventivo (mantenimientoId:number, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.visualizarPreventivo(mantenimientoId, usuario, idRol)
  }

  async visualizarCorrectivo (mantenimientoId:number, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.visualizarCorrectivo(mantenimientoId, usuario, idRol)
  }

  async visualizarAlistamiento (mantenimientoId:number, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.visualizarAlistamiento(mantenimientoId, usuario, idRol)
  }

  async listarHistorial (tipoId:number, vigiladoId:string, placa:string, idRol:number): Promise<any>{
    return this.repositorio.listarHistorial(tipoId, vigiladoId, placa, idRol)
  }

  async listarActividades (): Promise<any>{
    return this.repositorio.listarActividades()
  }

  async listarTiposIdentificacion (): Promise<any>{
    return this.repositorio.listarTiposIdentificacion()
  }

  async listarTrabajosFallidos (usuario: string, idRol: number, filtros?: { tipo?: string, estado?: string, nit?: string }): Promise<any[]> {
    return this.repositorio.listarTrabajosFallidos(usuario, idRol, filtros)
  }

  async listarTrabajosProgramados (
    usuario: string,
    idRol: number,
    filtros?: {
      estado?: string
      tipo?: string
      placa?: string
      vin?: string
      usuario?: string
      proveedor?: string
      sincronizacionEstado?: string
      nit?: string
      fecha?: string
    },
    pagina?: number,
    limite?: number,
    orden?: {
      campo?: string
      direccion?: 'asc' | 'desc'
    }
  ): Promise<Paginable<TrabajoProgramado>> {
    return this.repositorio.listarTrabajosProgramados(usuario, idRol, filtros, pagina, limite, orden)
  }

  async obtenerTrabajoProgramado (jobId: number, usuario: string, idRol: number): Promise<any> {
    return this.repositorio.obtenerTrabajoProgramado(jobId, usuario, idRol)
  }

  async reintentarTrabajoFallido (
    jobId: number,
    usuario: string,
    idRol: number,
    opciones?: {
      payload?: Record<string, any> | null,
      accion?: 'reprogramar' | 'actualizar' | 'marcarProcesado'
    }
  ): Promise<any> {
    return this.repositorio.reintentarTrabajoFallido(jobId, usuario, idRol, opciones)
  }

  async visualizarAutorizacion (mantenimientoId:number, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.visualizarAutorizacion(mantenimientoId, usuario, idRol)
  }

  async guardarAutorizacion (datos:any, usuario:string, idRol:number, opciones?:OpcionesSincronizacion): Promise<any>{
    return this.repositorio.guardarAutorizacion(datos, usuario, idRol, opciones)
  }

  async listarHistorialExportar (tipoId:number, vigiladoId:string, placa:string): Promise<any>{
    return this.repositorio.listarHistorialExportar(tipoId, vigiladoId, placa)
  }

  async guardarPreventivoMasivo (registros: any[], usuario: string, idRol: number): Promise<any> {
    const opciones: OpcionesSincronizacion = { diferido: true }
    const resultado = { total: registros.length, exitosos: 0, errores: [] as Array<{ indice: number, mensaje: string }> };

    for (const [indice, registro] of registros.entries()) {
      try {
        console.log('[Masivo preventivo] fila', indice + 1, {
          fecha: registro.fecha,
          hora: registro.hora,
          placa: registro.placa,
        });
        const mantenimiento = await this.guardarMantenimiento({ vigiladoId: registro.vigiladoId, placa: registro.placa, tipoId: 1 }, usuario, idRol, undefined, opciones)
        const mantenimientoLocalId = mantenimiento?.mantenimientoLocalId || mantenimiento?.mantenimientoIdLocal || mantenimiento?.mantenimientoId || mantenimiento?.id

        if (!mantenimientoLocalId) {
          throw new Error('No fue posible determinar el identificador local del mantenimiento')
        }

        const datosPreventivo = {
          placa: registro.placa,
          fecha: registro.fecha,
          hora: registro.hora,
          nit: registro.nit,
          razonSocial: registro.razonSocial,
          tipoIdentificacion: registro.tipoIdentificacion,
          numeroIdentificacion: registro.numeroIdentificacion,
          nombresResponsable: registro.nombresResponsable,
          mantenimientoId: mantenimientoLocalId,
          detalleActividades: registro.detalleActividades,
        }

        await this.guardarPreventivo(datosPreventivo, usuario, idRol, opciones)
        resultado.exitosos += 1
      } catch (error: any) {
        resultado.errores.push({ indice, mensaje: error.message || 'Error desconocido al programar preventivo' })
      }
    }

    return resultado
  }

  async guardarCorrectivoMasivo (registros: any[], usuario: string, idRol: number): Promise<any> {
    const opciones: OpcionesSincronizacion = { diferido: true }
    const resultado = { total: registros.length, exitosos: 0, errores: [] as Array<{ indice: number, mensaje: string }> };

    for (const [indice, registro] of registros.entries()) {
      try {
        const mantenimiento = await this.guardarMantenimiento({ vigiladoId: registro.vigiladoId, placa: registro.placa, tipoId: 2 }, usuario, idRol, undefined, opciones)
        const mantenimientoLocalId = mantenimiento?.mantenimientoLocalId || mantenimiento?.mantenimientoIdLocal || mantenimiento?.mantenimientoId || mantenimiento?.id

        if (!mantenimientoLocalId) {
          throw new Error('No fue posible determinar el identificador local del mantenimiento')
        }

        const datosCorrectivo = {
          placa: registro.placa,
          fecha: registro.fecha,
          hora: registro.hora,
          nit: registro.nit,
          razonSocial: registro.razonSocial,
          tipoIdentificacion: registro.tipoIdentificacion,
          numeroIdentificacion: registro.numeroIdentificacion,
          nombresResponsable: registro.nombresResponsable,
          mantenimientoId: mantenimientoLocalId,
          detalleActividades: registro.detalleActividades,
        }

        await this.guardarCorrectivo(datosCorrectivo, usuario, idRol, opciones)
        resultado.exitosos += 1
      } catch (error: any) {
        resultado.errores.push({ indice, mensaje: error.message || 'Error desconocido al programar correctivo' })
      }
    }

    return resultado
  }

  async guardarAlistamientoMasivo (registros: any[], usuario: string, idRol: number): Promise<any> {
    const opciones: OpcionesSincronizacion = { diferido: true }
    const resultado = { total: registros.length, exitosos: 0, errores: [] as Array<{ indice: number, mensaje: string }> };

    for (const [indice, registro] of registros.entries()) {
      try {
        const mantenimiento = await this.guardarMantenimiento({ vigiladoId: registro.vigiladoId, placa: registro.placa, tipoId: 3 }, usuario, idRol, undefined, opciones)
        const mantenimientoLocalId = mantenimiento?.mantenimientoLocalId || mantenimiento?.mantenimientoIdLocal || mantenimiento?.mantenimientoId || mantenimiento?.id

        if (!mantenimientoLocalId) {
          throw new Error('No fue posible determinar el identificador local del mantenimiento')
        }

        const actividadesArray = Array.isArray(registro.actividades)
          ? registro.actividades
          : typeof registro.actividades === 'string'
            ? registro.actividades.split(',').map((actividad: string) => actividad.trim()).filter((actividad: string) => actividad.length > 0)
            : []

        const datosAlistamiento = {
          placa: registro.placa,
          tipoIdentificacionResponsable: registro.tipoIdentificacionResponsable,
          numeroIdentificacionResponsable: registro.numeroIdentificacionResponsable,
          nombreResponsable: registro.nombreResponsable,
          tipoIdentificacionConductor: registro.tipoIdentificacionConductor,
          numeroIdentificacionConductor: registro.numeroIdentificacionConductor,
          nombresConductor: registro.nombresConductor,
          mantenimientoId: mantenimientoLocalId,
          detalleActividades: registro.detalleActividades,
          actividades: actividadesArray.map((actividad: any) => {
            const idActividad = typeof actividad === 'object' ? actividad.id ?? actividad : actividad
            return {
              id: Number(idActividad),
              estado: typeof actividad === 'object' && actividad.estado !== undefined ? actividad.estado : true,
            }
          }),
        }

        await this.guardarAlistamiento(datosAlistamiento, usuario, idRol, opciones)
        resultado.exitosos += 1
      } catch (error: any) {
        resultado.errores.push({ indice, mensaje: error.message || 'Error desconocido al programar alistamiento' })
      }
    }

    return resultado
  }

  async guardarAutorizacionMasiva (registros: any[], usuario: string, idRol: number): Promise<any> {
    const opciones: OpcionesSincronizacion = { diferido: true }
    const resultado = { total: registros.length, exitosos: 0, errores: [] as Array<{ indice: number, mensaje: string }> };

    for (const [indice, registro] of registros.entries()) {
      try {
        const mantenimiento = await this.guardarMantenimiento({ vigiladoId: registro.vigiladoId, placa: registro.placa, tipoId: 4 }, usuario, idRol, undefined, opciones)
        const mantenimientoLocalId = mantenimiento?.mantenimientoLocalId || mantenimiento?.mantenimientoIdLocal || mantenimiento?.mantenimientoId || mantenimiento?.id

        if (!mantenimientoLocalId) {
          throw new Error('No fue posible determinar el identificador local del mantenimiento')
        }

        const datosAutorizacion = {
          ...registro,
          mantenimientoId: mantenimientoLocalId,
        }

        await this.guardarAutorizacion(datosAutorizacion, usuario, idRol, opciones)
        resultado.exitosos += 1
      } catch (error: any) {
        resultado.errores.push({ indice, mensaje: error.message || 'Error desconocido al programar autorización' })
      }
    }

    return resultado
  }

}
