/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { Exception } from "@adonisjs/core/build/standalone";
import { RepositorioMantenimiento } from "App/Dominio/Repositorios/RepositorioMantenimiento";
import Env from "@ioc:Adonis/Core/Env";
import axios from "axios";
import TblMantenimiento from "App/Infraestructura/Datos/Entidad/Mantenimiento";
import { DateTime } from "luxon";
import TblUsuarios from "App/Infraestructura/Datos/Entidad/Usuario";
import TblPreventivo from "App/Infraestructura/Datos/Entidad/Preventivos";
import TblCorrectivo from "App/Infraestructura/Datos/Entidad/Correctivo";
import TblAlistamiento from "App/Infraestructura/Datos/Entidad/Alistamiento";
import TblActividadesAlistamiento from "App/Infraestructura/Datos/Entidad/ActividadesAlistamiento";
import TblDetallesAlistamientoActividades from "App/Infraestructura/Datos/Entidad/DetallesAlistamientoActividades";
import TblAutorizaciones from "App/Infraestructura/Datos/Entidad/Autorizaciones";
import { TokenExterno } from "App/Dominio/Utilidades/TokenExterno";
import TblMantenimientoJob, { TipoMantenimientoJob } from "App/Infraestructura/Datos/Entidad/MantenimientoJob";
import { OpcionesSincronizacion } from "App/Dominio/Repositorios/RepositorioMantenimiento";
import type { ModelQueryBuilderContract } from "@ioc:Adonis/Lucid/Orm";
import { Paginable, TrabajoProgramado } from "App/Dominio/Tipos/Tipos";
import { Paginador } from "App/Dominio/Paginador";

export class MantenimientoPendienteError extends Error {}

export class RepositorioMantenimientoDB implements RepositorioMantenimiento {
  private readonly MAX_REINTENTOS = 3;

  private getColombiaDate(): Date {
    const offsetHours = parseInt(Env.get('TIMEZONE_OFFSET_HOURS', '5'));
    const now = new Date();
    return new Date(now.getTime() - (offsetHours * 60 * 60 * 1000));
  }

  private getColombiaDateTime(): DateTime {
    return DateTime.fromJSDate(this.getColombiaDate());
  }

  private async crearJob(params: {
    tipo: TipoMantenimientoJob
    mantenimientoLocalId?: number | null
    detalleId?: number | null
    vigiladoId: string
    usuario: string
    rolId: number
    payload?: Record<string, any> | null
  }): Promise<TblMantenimientoJob> {
    const job = await TblMantenimientoJob.create({
      tipo: params.tipo,
      mantenimientoLocalId: params.mantenimientoLocalId ?? null,
      detalleId: params.detalleId ?? null,
      vigiladoId: params.vigiladoId,
      usuarioDocumento: params.usuario,
      rolId: params.rolId,
      estado: 'pendiente',
      reintentos: 0,
      siguienteIntento: this.getColombiaDateTime(),
      payload: params.payload ?? null,
    });
    return job;
  }

  private async validarTokenExterno(): Promise<string> {
    const token = await TokenExterno.get();
    if (!token || !TokenExterno.isVigente()) {
      throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
    }
    return token;
  }

  private convertirErrorExterno(errorExterno: any, mensajePorDefecto: string): never {
    const datosRespuesta = errorExterno?.response?.data ?? errorExterno?.data ?? errorExterno.responseData ?? null;
    const mensajeRespuesta =
      datosRespuesta?.mensaje ??
      datosRespuesta?.message ??
      datosRespuesta?.error ??
      (Array.isArray(datosRespuesta?.errors) ? datosRespuesta.errors[0]?.message : null) ??
      null;

    const mensajeFinal = mensajeRespuesta ?? mensajePorDefecto;
    const status = errorExterno?.response?.status || errorExterno?.status || 500;

    const exception = new Exception(mensajeFinal, status);

    (exception as any).mensajeApi = mensajeRespuesta ?? null;
    (exception as any).mensajeInterno = mensajeFinal;

    let responseData: Record<string, any> | null = null;

    if (datosRespuesta && typeof datosRespuesta === 'object' && !Array.isArray(datosRespuesta)) {
      responseData = { ...datosRespuesta };
    } else if (datosRespuesta !== null && datosRespuesta !== undefined) {
      responseData = { detalle: datosRespuesta };
    }

    if (!responseData) {
      responseData = {};
    }

    const mensajeNormalizado = typeof responseData.mensaje === 'string' ? responseData.mensaje.trim() : '';
    if (!mensajeNormalizado) {
      responseData.mensaje = mensajeFinal;
    }

    if (responseData.status === undefined && Number.isFinite(Number(status))) {
      responseData.status = Number(status);
    }

    if (datosRespuesta && Array.isArray(datosRespuesta)) {
      responseData.detalle = datosRespuesta;
    }

    (exception as any).responseData = responseData;
    (exception as any).rawError = errorExterno;

    if (!exception.stack && typeof errorExterno?.stack === 'string') {
      exception.stack = errorExterno.stack;
    }

    throw exception;
  }

  private async marcarMantenimientoProcesado(opciones: { mantenimientoLocalId?: number | null, mantenimientoIdExterno?: number | null }): Promise<void> {
    if (!opciones.mantenimientoLocalId) {
      return;
    }

    const mantenimiento = await TblMantenimiento.find(opciones.mantenimientoLocalId);
    if (!mantenimiento) {
      return;
    }

    const campos: Partial<{ procesado: boolean; mantenimientoId: number | null }> = { procesado: true };
    if (opciones.mantenimientoIdExterno !== undefined && opciones.mantenimientoIdExterno !== null) {
      campos.mantenimientoId = opciones.mantenimientoIdExterno;
    }

    mantenimiento.merge(campos);
    await mantenimiento.save();

    if (mantenimiento.id) {
      await TblMantenimientoJob
        .query()
        .where('tmj_mantenimiento_local_id', mantenimiento.id)
        .whereNot('tmj_tipo', 'base')
        .where('tmj_estado', 'fallido')
        .where('tmj_ultimo_error', 'El mantenimiento base aún no ha sido sincronizado')
        .update({
          tmj_estado: 'pendiente',
          tmj_reintentos: 0,
          tmj_ultimo_error: null,
          tmj_siguiente_intento: DateTime.now().toJSDate()
        });
    }
  }

  private async restringirTrabajosPorUsuario(
    query: ModelQueryBuilderContract<typeof TblMantenimientoJob>,
    usuario: string,
    idRol: number
  ): Promise<void> {
    if (idRol === 3) {
      query.andWhere('tmj_vigilado_id', usuario);
      return;
    }

    const usuarioDb = await TblUsuarios.query().where('identificacion', usuario).first();

    if (!usuarioDb) {
      throw new Exception("Usuario no encontrado", 404);
    }

    const valoresPermitidos = new Set<string>();

    if (usuarioDb.identificacion) {
      valoresPermitidos.add(String(usuarioDb.identificacion));
    }

    if (usuarioDb.id) {
      valoresPermitidos.add(String(usuarioDb.id));
    }

    if (valoresPermitidos.size === 0) {
      query.whereRaw('1 = 0');
      return;
    }

    const permitidos = Array.from(valoresPermitidos);

    query.andWhere((builder) => {
      builder.whereIn('tmj_vigilado_id', permitidos).orWhere('tmj_usuario_documento', usuario);
    });
  }

  private async asegurarPermisoSobreJob(job: TblMantenimientoJob, usuario: string, idRol: number): Promise<void> {
  /*   if (idRol === 3) {
      if (job.usuarioDocumento !== usuario) {
        throw new Exception('No cuenta con permisos para gestionar este trabajo', 403);
      }
      return;
    } */

    const usuarioDb = await TblUsuarios.query().where('identificacion', usuario).first();

    if (!usuarioDb) {
      throw new Exception("Usuario no encontrado", 404);
    }

    const valoresPermitidos = new Set<string>();

    if (usuarioDb.identificacion) {
      valoresPermitidos.add(String(usuarioDb.identificacion));
    }

    if (usuarioDb.id) {
      valoresPermitidos.add(String(usuarioDb.id));
    }

    const vigiladoJob = String(job.vigiladoId ?? '');

    if (!valoresPermitidos.has(vigiladoJob) && job.usuarioDocumento !== usuario) {
      throw new Exception('No cuenta con permisos para gestionar este trabajo', 403);
    }
  }

  private normalizarActividades(actividadesEntrada: any): Array<{ id: number; estado: boolean }> {
    if (!actividadesEntrada) {
      return [];
    }

    if (typeof actividadesEntrada === 'string') {
      const texto = actividadesEntrada.trim();
      if (texto.startsWith('[') && texto.endsWith(']')) {
        try {
          const parsed = JSON.parse(texto);
          if (Array.isArray(parsed)) {
            return this.normalizarActividades(parsed);
          }
        } catch (error) {
          // ignorar errores de parseo y continuar con la lógica estándar
        }
      }
    }

    const comoArreglo = Array.isArray(actividadesEntrada)
      ? actividadesEntrada
      : typeof actividadesEntrada === 'string'
        ? actividadesEntrada.split(',')
        : [actividadesEntrada];

    const resultado: Array<{ id: number; estado: boolean }> = [];

    for (const item of comoArreglo) {
      if (item === null || item === undefined) {
        continue;
      }

      if (typeof item === 'object' && !Array.isArray(item)) {
        const posibleId = item.id ?? item.actividadId ?? item.value ?? item;
        const id = Number(typeof posibleId === 'string' ? posibleId.trim() : posibleId);
        if (Number.isFinite(id)) {
          const estadoBruto = item.estado ?? item.tda_estado ?? item.state;
          let estado = true;
          if (typeof estadoBruto === 'boolean') {
            estado = estadoBruto;
          } else if (typeof estadoBruto === 'string') {
            const normalizado = estadoBruto.trim().toLowerCase();
            estado = !['0', 'false', 'no', 'n', 'off'].includes(normalizado);
          } else if (typeof estadoBruto === 'number') {
            estado = estadoBruto !== 0;
          }
          resultado.push({ id, estado });
        }
        continue;
      }

      const comoTexto = String(item).trim();
      if (comoTexto === '') {
        continue;
      }
      const id = Number(comoTexto);
      if (Number.isFinite(id)) {
        resultado.push({ id, estado: true });
      }
    }

    return resultado;
  }

  private actividadesParaApi(actividadesEntrada: any): number[] {
    return Array.from(new Set(this.normalizarActividades(actividadesEntrada).map((actividad) => actividad.id)));
  }

  private jobEstaProcesado(
    job: TblMantenimientoJob,
    mantenimiento?: TblMantenimiento | null,
    detalle?: TblPreventivo | TblCorrectivo | TblAlistamiento | TblAutorizaciones | null
  ): boolean {
    const procesadoBase = Boolean(mantenimiento?.procesado || mantenimiento?.mantenimientoId);

    switch (job.tipo) {
      case 'base':
        return procesadoBase;
      case 'preventivo':
      case 'correctivo':
        if (detalle) {
          const detalleProcesado = Boolean((detalle as TblPreventivo | TblCorrectivo).procesado);
          const detalleSincronizado = Boolean((detalle as TblPreventivo | TblCorrectivo).mantenimientoId);
          return detalleProcesado || detalleSincronizado || procesadoBase;
        }
        return procesadoBase;
      case 'alistamiento':
        if (detalle) {
          const alistamiento = detalle as TblAlistamiento;
          return Boolean(alistamiento.procesado || alistamiento.mantenimientoId || procesadoBase);
        }
        return procesadoBase;
      case 'autorizacion':
        if (detalle) {
          const autorizacion = detalle as TblAutorizaciones;
          return Boolean(autorizacion.mantenimientoId || procesadoBase);
        }
        return procesadoBase;
      default:
        return procesadoBase;
    }
  }

  private construirDatosCompletos(
    job: TblMantenimientoJob,
    mantenimiento?: TblMantenimiento | null,
    detalle?: Record<string, any> | null
  ): Record<string, any> {
    const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
    const detalleDatos = detalle && typeof detalle === 'object' ? detalle : {};
    const vigiladoId = job.vigiladoId ?? (mantenimiento?.usuarioId ? String(mantenimiento.usuarioId) : null);

    const base: Record<string, any> = {
      tipo: job.tipo,
      vigiladoId,
      placa: detalleDatos.placa ?? mantenimiento?.placa ?? payload.placa ?? null,
      tipoId: mantenimiento?.tipoId ?? payload.tipoId ?? null,
      mantenimientoLocalId: job.mantenimientoLocalId ?? detalleDatos.mantenimientoId ?? null,
      detalleId: job.detalleId ?? null,
    };

    switch (job.tipo) {
      case 'base':
        return {
          ...base,
        };
      case 'preventivo':
      case 'correctivo':
        return {
          ...base,
          fecha: detalleDatos.fecha ?? payload.fecha ?? null,
          hora: detalleDatos.hora ?? payload.hora ?? null,
          nit: detalleDatos.nit ?? payload.nit ?? null,
          razonSocial: detalleDatos.razonSocial ?? payload.razonSocial ?? null,
          tipoIdentificacion: detalleDatos.tipoIdentificacion ?? payload.tipoIdentificacion ?? null,
          numeroIdentificacion: detalleDatos.numeroIdentificacion ?? payload.numeroIdentificacion ?? null,
          nombresResponsable: detalleDatos.nombresResponsable ?? payload.nombresResponsable ?? null,
          detalleActividades: detalleDatos.detalleActividades ?? payload.detalleActividades ?? null,
        };
      case 'alistamiento':
        return {
          ...base,
          tipoIdentificacionResponsable: detalleDatos.tipoIdentificacionResponsable ?? payload.tipoIdentificacionResponsable ?? null,
          numeroIdentificacionResponsable: detalleDatos.numeroIdentificacionResponsable ?? payload.numeroIdentificacionResponsable ?? null,
          nombreResponsable: detalleDatos.nombreResponsable ?? payload.nombreResponsable ?? null,
          tipoIdentificacionConductor: detalleDatos.tipoIdentificacionConductor ?? payload.tipoIdentificacionConductor ?? null,
          numeroIdentificacionConductor: detalleDatos.numeroIdentificacionConductor ?? payload.numeroIdentificacionConductor ?? null,
          nombresConductor: detalleDatos.nombresConductor ?? payload.nombresConductor ?? null,
          detalleActividades: detalleDatos.detalleActividades ?? payload.detalleActividades ?? null,
          actividades: detalleDatos.actividades ?? this.normalizarActividades(payload.actividades ?? []),
        };
      case 'autorizacion':
        return {
          ...base,
          ...payload,
          ...detalleDatos,
        };
      default:
        return {
          ...base,
          ...payload,
        };
    }
  }

  private construirMantenimientoRespuesta(job: TblMantenimientoJob, mantenimiento?: TblMantenimiento | null): Record<string, any> {
    if (mantenimiento) {
      return mantenimiento.toJSON();
    }

    const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};

    return {
      id: job.mantenimientoLocalId ?? null,
      placa: payload.placa ?? null,
      tipoId: payload.tipoId ?? null,
      estado: null,
      procesado: false,
      mantenimientoId: null,
      vigiladoId: job.vigiladoId ?? null,
      usuarioId: null,
      fechaDiligenciamiento: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  private construirDetalleRespuesta(
    job: TblMantenimientoJob,
    mantenimiento: TblMantenimiento | null,
    detalle: TblPreventivo | TblCorrectivo | TblAlistamiento | TblAutorizaciones | null,
    payload: Record<string, any>
  ): Record<string, any> {
    if (detalle) {
      return detalle.toJSON();
    }

    const tipoMantenimiento = mantenimiento?.tipoId ?? payload.tipoId ?? null;
    const placaBase = payload.placa ?? mantenimiento?.placa ?? null;
    const mantenimientoId = payload.mantenimientoId ?? job.mantenimientoLocalId ?? null;

    const construirPreventivoOCorrectivo = () => ({
      placa: placaBase,
      fecha: payload.fecha ?? null,
      hora: payload.hora ?? null,
      nit: payload.nit ?? null,
      razonSocial: payload.razonSocial ?? null,
      tipoIdentificacion: payload.tipoIdentificacion ?? null,
      numeroIdentificacion: payload.numeroIdentificacion ?? null,
      nombresResponsable: payload.nombresResponsable ?? null,
      mantenimientoId,
      detalleActividades: payload.detalleActividades ?? null,
      procesado: false,
    });

    const construirAlistamiento = () => ({
      placa: placaBase,
      tipoIdentificacionResponsable: payload.tipoIdentificacionResponsable ?? null,
      numeroIdentificacionResponsable: payload.numeroIdentificacionResponsable ?? null,
      nombreResponsable: payload.nombreResponsable ?? null,
      tipoIdentificacionConductor: payload.tipoIdentificacionConductor ?? null,
      numeroIdentificacionConductor: payload.numeroIdentificacionConductor ?? null,
      nombresConductor: payload.nombresConductor ?? null,
      mantenimientoId,
      detalleActividades: payload.detalleActividades ?? null,
      actividades: this.normalizarActividades(payload.actividades ?? []),
      procesado: false,
    });

    const construirAutorizacion = () => ({
      fechaViaje: payload.fechaViaje ?? null,
      origen: payload.origen ?? null,
      destino: payload.destino ?? null,
      tipoIdentificacionNna: payload.tipoIdentificacionNna ?? null,
      numeroIdentificacionNna: payload.numeroIdentificacionNna ?? null,
      nombresApellidosNna: payload.nombresApellidosNna ?? null,
      situacionDiscapacidad: payload.situacionDiscapacidad ?? null,
      tipoDiscapacidad: payload.tipoDiscapacidad ?? null,
      perteneceComunidadEtnica: payload.perteneceComunidadEtnica ?? null,
      tipoPoblacionEtnica: payload.tipoPoblacionEtnica ?? null,
      tipoIdentificacionOtorgante: payload.tipoIdentificacionOtorgante ?? null,
      numeroIdentificacionOtorgante: payload.numeroIdentificacionOtorgante ?? null,
      nombresApellidosOtorgante: payload.nombresApellidosOtorgante ?? null,
      numeroTelefonicoOtorgante: payload.numeroTelefonicoOtorgante ?? null,
      correoElectronicoOtorgante: payload.correoElectronicoOtorgante ?? null,
      direccionFisicaOtorgante: payload.direccionFisicaOtorgante ?? null,
      sexoOtorgante: payload.sexoOtorgante ?? null,
      generoOtorgante: payload.generoOtorgante ?? null,
      calidadActua: payload.calidadActua ?? null,
      tipoIdentificacionAutorizadoViajar: payload.tipoIdentificacionAutorizadoViajar ?? null,
      numeroIdentificacionAutorizadoViajar: payload.numeroIdentificacionAutorizadoViajar ?? null,
      nombresApellidosAutorizadoViajar: payload.nombresApellidosAutorizadoViajar ?? null,
      numeroTelefonicoAutorizadoViajar: payload.numeroTelefonicoAutorizadoViajar ?? null,
      direccionFisicaAutorizadoViajar: payload.direccionFisicaAutorizadoViajar ?? null,
      tipoIdentificacionAutorizadoRecoger: payload.tipoIdentificacionAutorizadoRecoger ?? null,
      numeroIdentificacionAutorizadoRecoger: payload.numeroIdentificacionAutorizadoRecoger ?? null,
      nombresApellidosAutorizadoRecoger: payload.nombresApellidosAutorizadoRecoger ?? null,
      numeroTelefonicoAutorizadoRecoger: payload.numeroTelefonicoAutorizadoRecoger ?? null,
      direccionFisicaAutorizadoRecoger: payload.direccionFisicaAutorizadoRecoger ?? null,
      copiaAutorizacionViajeNombreOriginal: payload.copiaAutorizacionViajeNombreOriginal ?? null,
      copiaAutorizacionViajeDocumento: payload.copiaAutorizacionViajeDocumento ?? null,
      copiaAutorizacionViajeRuta: payload.copiaAutorizacionViajeRuta ?? null,
      copiaDocumentoParentescoNombreOriginal: payload.copiaDocumentoParentescoNombreOriginal ?? null,
      copiaDocumentoParentescoDocumento: payload.copiaDocumentoParentescoDocumento ?? null,
      copiaDocumentoParentescoRuta: payload.copiaDocumentoParentescoRuta ?? null,
      copiaDocumentoIdentidadAutorizadoNombreOriginal: payload.copiaDocumentoIdentidadAutorizadoNombreOriginal ?? null,
      copiaDocumentoIdentidadAutorizadoDocumento: payload.copiaDocumentoIdentidadAutorizadoDocumento ?? null,
      copiaDocumentoIdentidadAutorizadoRuta: payload.copiaDocumentoIdentidadAutorizadoRuta ?? null,
      copiaConstanciaEntregaNombreOriginal: payload.copiaConstanciaEntregaNombreOriginal ?? null,
      copiaConstanciaEntregaDocumento: payload.copiaConstanciaEntregaDocumento ?? null,
      copiaConstanciaEntregaRuta: payload.copiaConstanciaEntregaRuta ?? null,
      mantenimientoId,
    });

    switch (job.tipo) {
      case 'base':
        switch (tipoMantenimiento) {
          case 1:
          case 2:
            return construirPreventivoOCorrectivo();
          case 3:
            return construirAlistamiento();
          case 4:
            return construirAutorizacion();
          default:
            return {
              vigiladoId: job.vigiladoId ?? null,
              placa: placaBase,
              tipoId: tipoMantenimiento,
              mantenimientoId,
            };
        }
      case 'preventivo':
      case 'correctivo':
        return construirPreventivoOCorrectivo();
      case 'alistamiento':
        return construirAlistamiento();
      case 'autorizacion':
        return construirAutorizacion();
      default:
        return {
          ...payload,
        };
    }
  }

  private fusionarPlanos(base: any, complemento: any): any {
    const esObjetoPlano = (valor: any) => Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);

    if (esObjetoPlano(base) || esObjetoPlano(complemento)) {
      return {
        ...(esObjetoPlano(base) ? { ...base } : {}),
        ...(esObjetoPlano(complemento) ? { ...complemento } : {}),
      };
    }

    if (Array.isArray(complemento)) {
      return [...complemento];
    }

    if (Array.isArray(base)) {
      return [...base];
    }

    return complemento ?? base ?? null;
  }

  private resolverEstadoCombinado(estadoCabecera?: string | null, estadoDetalle?: string | null): string | null {
    const prioridad = ['fallido', 'pendiente', 'procesando', 'procesado'];
    const estados = [estadoCabecera, estadoDetalle].filter((estado): estado is string => typeof estado === 'string' && estado.trim() !== '');

    if (estados.length === 0) {
      return estadoDetalle ?? estadoCabecera ?? null;
    }

    for (const estadoPrioritario of prioridad) {
      if (estados.includes(estadoPrioritario)) {
        return estadoPrioritario;
      }
    }

    return estados[0];
  }

  private obtenerClaveAgrupacionTrabajo(trabajo: any): string {
    const candidatosNumericos: number[] = [];
    const agregarCandidato = (valor: any) => {
      if (typeof valor === 'number' && Number.isFinite(valor)) {
        candidatosNumericos.push(valor);
      }
    };

    agregarCandidato(trabajo?.mantenimientoLocalId);
    agregarCandidato(trabajo?.mantenimiento?.id);
    agregarCandidato(trabajo?.datosCompletos?.mantenimientoLocalId);
    agregarCandidato(trabajo?.datosCompletos?.mantenimientoId);
    agregarCandidato(trabajo?.payload?.mantenimientoId);
    agregarCandidato(trabajo?.detalle?.mantenimientoId);

    if (candidatosNumericos.length > 0) {
      return `mantenimiento-${candidatosNumericos[0]}`;
    }

    const placa = String(trabajo?.payload?.placa ?? trabajo?.mantenimiento?.placa ?? trabajo?.datosCompletos?.placa ?? '').toLowerCase();
    const tipoId = trabajo?.mantenimiento?.tipoId ?? trabajo?.payload?.tipoId ?? trabajo?.datosCompletos?.tipoId ?? '';
    const vigiladoId = trabajo?.vigiladoId ?? trabajo?.payload?.vigiladoId ?? trabajo?.datosCompletos?.vigiladoId ?? '';

    return `alterno-${placa}-${tipoId ?? ''}-${vigiladoId ?? ''}`;
  }

  private normalizarFechaParaEnvio(fecha: any): string | null {
    try {
      if (!fecha) {
        return null;
      }

      if (typeof fecha === 'string') {
        const iso = DateTime.fromISO(fecha, { zone: 'utc' });
        if (iso.isValid) {
          return iso.toISODate();
        }

        const desdeJS = DateTime.fromJSDate(new Date(fecha)).setZone('utc');
        return desdeJS.isValid ? desdeJS.toISODate() : null;
      }

      if (fecha instanceof Date) {
        return DateTime.fromObject(
          {
            year: fecha.getFullYear(),
            month: fecha.getMonth() + 1,
            day: fecha.getDate(),
          },
          { zone: 'utc' }
        ).toISODate();
      }

      if (typeof fecha === 'object' && typeof (fecha as any).toJSDate === 'function') {
        const jsDate = (fecha as any).toJSDate();
        return DateTime.fromObject(
          {
            year: jsDate.getFullYear(),
            month: jsDate.getMonth() + 1,
            day: jsDate.getDate(),
          },
          { zone: 'utc' }
        ).toISODate();
      }

      return null;
    } catch (_err) {
      return null;
    }
  }

  private async vincularCabeceras(trabajos: any[]): Promise<any[]> {
    if (!Array.isArray(trabajos) || trabajos.length === 0) {
      return [];
    }

    const obtenerIdMantenimiento = (trabajo: any): number | null => {
      const candidatosNumericos: number[] = [];
      const agregarCandidato = (valor: any) => {
        if (typeof valor === 'number' && Number.isFinite(valor)) {
          candidatosNumericos.push(valor);
        }
      };

      agregarCandidato(trabajo?.mantenimientoLocalId);
      agregarCandidato(trabajo?.mantenimiento?.id);
      agregarCandidato(trabajo?.datosCompletos?.mantenimientoLocalId);
      agregarCandidato(trabajo?.datosCompletos?.mantenimientoId);
      agregarCandidato(trabajo?.payload?.mantenimientoId);
      agregarCandidato(trabajo?.detalle?.mantenimientoId);

      return candidatosNumericos.length > 0 ? candidatosNumericos[0] : null;
    };

    const estadoPorMantenimiento = new Map<number, { base: boolean; detalle: boolean }>();
    const idsExistentes = new Set<number>();

    for (const trabajo of trabajos) {
      if (typeof trabajo?.id === 'number') {
        idsExistentes.add(trabajo.id);
      }

      const mantenimientoId = obtenerIdMantenimiento(trabajo);
      if (mantenimientoId === null) {
        continue;
      }

      const registro = estadoPorMantenimiento.get(mantenimientoId) ?? { base: false, detalle: false };
      if (trabajo?.tipo === 'base') {
        registro.base = true;
      } else {
        registro.detalle = true;
      }
      estadoPorMantenimiento.set(mantenimientoId, registro);
    }

    const idsParaCompletar: number[] = [];
    for (const [id, estado] of estadoPorMantenimiento.entries()) {
      if ((estado.base && !estado.detalle) || (!estado.base && estado.detalle)) {
        idsParaCompletar.push(id);
      }
    }

    if (idsParaCompletar.length > 0) {
      const faltantes = await TblMantenimientoJob.query()
        .whereIn('tmj_mantenimiento_local_id', idsParaCompletar)
        .orderBy('tmj_creado', 'asc');

      if (faltantes.length > 0) {
        const mapeados = await this.mapearTrabajosConDetalle(faltantes);
        for (const item of mapeados) {
          if (typeof item?.id === 'number' && idsExistentes.has(item.id)) {
            continue;
          }
          trabajos.push(item);
        }
      }
    }

    const cabecerasPorClave = new Map<string, any>();
    const clavesUtilizadas = new Set<string>();

    for (const trabajo of trabajos) {
      if (!trabajo || trabajo.tipo !== 'base') {
        continue;
      }

      const clave = this.obtenerClaveAgrupacionTrabajo(trabajo);
      if (!cabecerasPorClave.has(clave)) {
        cabecerasPorClave.set(clave, trabajo);
        continue;
      }

      const existente = cabecerasPorClave.get(clave);
      const marcaExistente = existente?.updatedAt ?? existente?.createdAt ?? null;
      const marcaActual = trabajo?.updatedAt ?? trabajo?.createdAt ?? null;
      if (!marcaExistente || !marcaActual || String(marcaActual) >= String(marcaExistente)) {
        cabecerasPorClave.set(clave, trabajo);
      }
    }

    const resultado: any[] = [];

    for (const trabajo of trabajos) {
      if (!trabajo || trabajo.tipo === 'base') {
        continue;
      }

      const clave = this.obtenerClaveAgrupacionTrabajo(trabajo);
      const cabecera = cabecerasPorClave.get(clave) ?? null;
      if (cabecera) {
        clavesUtilizadas.add(clave);
      }

      const datosCompletos = this.fusionarPlanos(cabecera?.datosCompletos, trabajo?.datosCompletos);
      const payload = this.fusionarPlanos(cabecera?.payload, trabajo?.payload);
      const mantenimiento = this.fusionarPlanos(cabecera?.mantenimiento, trabajo?.mantenimiento);

      const trabajosAsociados: Array<{ id: number | null; tipo: string | null; estado: string | null; ultimoError: string | null; reintentos: number }> = [];

      if (cabecera) {
        trabajosAsociados.push({
          id: cabecera.id ?? null,
          tipo: cabecera.tipo ?? null,
          estado: cabecera.estado ?? null,
          ultimoError: cabecera.ultimoError ?? null,
          reintentos: cabecera.reintentos ?? 0,
        });
      }

      trabajosAsociados.push({
        id: trabajo.id ?? null,
        tipo: trabajo.tipo ?? null,
        estado: trabajo.estado ?? null,
        ultimoError: trabajo.ultimoError ?? null,
        reintentos: trabajo.reintentos ?? 0,
      });

      const estado = this.resolverEstadoCombinado(cabecera?.estado, trabajo?.estado);
      const reintentos = Math.max(cabecera?.reintentos ?? 0, trabajo?.reintentos ?? 0);
      const ultimoError = trabajo?.ultimoError ?? cabecera?.ultimoError ?? null;
      const siguienteIntento = trabajo?.siguienteIntento ?? cabecera?.siguienteIntento ?? null;

      resultado.push({
        ...trabajo,
        estado,
        reintentos,
        ultimoError,
        siguienteIntento,
        payload,
        mantenimiento,
        datosCompletos,
        cabecera: cabecera
          ? {
              id: cabecera.id ?? null,
              estado: cabecera.estado ?? null,
              ultimoError: cabecera.ultimoError ?? null,
              reintentos: cabecera.reintentos ?? 0,
              siguienteIntento: cabecera.siguienteIntento ?? null,
              payload: cabecera.payload ?? null,
              datosCompletos: cabecera.datosCompletos ?? null,
            }
          : null,
        cabeceraId: cabecera?.id ?? null,
        trabajosAsociados,
      });
    }

    for (const [clave, cabecera] of cabecerasPorClave.entries()) {
      if (clavesUtilizadas.has(clave)) {
        continue;
      }

      resultado.push({
        ...cabecera,
        cabecera: null,
        cabeceraId: cabecera?.id ?? null,
        trabajosAsociados: [
          {
            id: cabecera.id ?? null,
            tipo: cabecera.tipo ?? null,
            estado: cabecera.estado ?? null,
            ultimoError: cabecera.ultimoError ?? null,
            reintentos: cabecera.reintentos ?? 0,
          },
        ],
      });
    }

    return resultado;
  }

  private async actualizarDatosLocales(job: TblMantenimientoJob, payload?: Record<string, any> | null): Promise<void> {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    switch (job.tipo) {
      case 'base':
        await this.actualizarMantenimientoBase(job.mantenimientoLocalId ?? null, payload);
        break;
      case 'preventivo':
        await this.actualizarPreventivoLocal(job.detalleId ?? null, payload);
        break;
      case 'correctivo':
        await this.actualizarCorrectivoLocal(job.detalleId ?? null, payload);
        break;
      case 'alistamiento':
        await this.actualizarAlistamientoLocal(job.detalleId ?? null, payload);
        break;
      case 'autorizacion':
        await this.actualizarAutorizacionLocal(job.detalleId ?? null, payload);
        break;
      default:
        break;
    }
  }

  private async actualizarMantenimientoBase(mantenimientoId: number | null, payload: Record<string, any>): Promise<void> {
    if (!mantenimientoId) {
      return;
    }

    const mantenimiento = await TblMantenimiento.find(mantenimientoId);
    if (!mantenimiento) {
      return;
    }

    const campos: Partial<TblMantenimiento> = {};

    if (typeof payload.placa === 'string' && payload.placa.trim() !== '') {
      campos.placa = payload.placa.trim().toUpperCase();
    }

    if (typeof payload.tipoId === 'number' && Number.isFinite(payload.tipoId)) {
      campos.tipoId = payload.tipoId;
    }

    if (Object.keys(campos).length > 0) {
      mantenimiento.merge(campos);
      await mantenimiento.save();
    }
  }

  private async actualizarPreventivoLocal(detalleId: number | null, payload: Record<string, any>): Promise<void> {
    if (!detalleId) {
      return;
    }

    const campos: Record<string, any> = {};

    if (typeof payload.fecha === 'string' || payload.fecha instanceof Date) {
      const fecha = payload.fecha instanceof Date ? payload.fecha : new Date(payload.fecha);
      if (!Number.isNaN(fecha.getTime())) {
        campos.fecha = fecha;
      }
    }

    if (typeof payload.hora === 'string') {
      campos.hora = payload.hora.trim();
    }

    if (typeof payload.nit === 'number' || typeof payload.nit === 'string') {
      const nit = Number(payload.nit);
      if (Number.isFinite(nit)) {
        campos.nit = nit;
      }
    }

    if (typeof payload.razonSocial === 'string') {
      campos.razonSocial = payload.razonSocial.trim();
    }

    if (typeof payload.tipoIdentificacion === 'number' || typeof payload.tipoIdentificacion === 'string') {
      const tipoIdentificacion = Number(payload.tipoIdentificacion);
      if (Number.isFinite(tipoIdentificacion)) {
        campos.tipoIdentificacion = tipoIdentificacion;
      }
    }

    if (typeof payload.numeroIdentificacion === 'number' || typeof payload.numeroIdentificacion === 'string') {
      const numeroIdentificacion = Number(payload.numeroIdentificacion);
      if (Number.isFinite(numeroIdentificacion)) {
        campos.numeroIdentificacion = numeroIdentificacion;
      }
    }

    const responsablePreventivo = (() => {
      if (typeof payload.nombresResponsable === 'string' && payload.nombresResponsable.trim() !== '') {
        return payload.nombresResponsable.trim();
      }
      if (typeof payload.nombreIngeniero === 'string' && payload.nombreIngeniero.trim() !== '') {
        return payload.nombreIngeniero.trim();
      }
      return null;
    })();

    if (responsablePreventivo) {
      campos.nombresResponsable = responsablePreventivo;
    }

    if (typeof payload.detalleActividades === 'string') {
      campos.detalleActividades = payload.detalleActividades.trim();
    }

    if (typeof payload.placa === 'string' && payload.placa.trim() !== '') {
      campos.placa = payload.placa.trim().toUpperCase();
    }

    if (Object.keys(campos).length > 0) {
      await TblPreventivo.query().where('id', detalleId).update(campos);
    }
  }

  private async actualizarCorrectivoLocal(detalleId: number | null, payload: Record<string, any>): Promise<void> {
    if (!detalleId) {
      return;
    }

    const campos: Record<string, any> = {};

    if (typeof payload.fecha === 'string' || payload.fecha instanceof Date) {
      const fecha = payload.fecha instanceof Date ? payload.fecha : new Date(payload.fecha);
      if (!Number.isNaN(fecha.getTime())) {
        campos.fecha = fecha;
      }
    }

    if (typeof payload.hora === 'string') {
      campos.hora = payload.hora.trim();
    }

    if (typeof payload.nit === 'number' || typeof payload.nit === 'string') {
      const nit = Number(payload.nit);
      if (Number.isFinite(nit)) {
        campos.nit = nit;
      }
    }

    if (typeof payload.razonSocial === 'string') {
      campos.razonSocial = payload.razonSocial.trim();
    }

    if (typeof payload.tipoIdentificacion === 'number' || typeof payload.tipoIdentificacion === 'string') {
      const tipoIdentificacion = Number(payload.tipoIdentificacion);
      if (Number.isFinite(tipoIdentificacion)) {
        campos.tipoIdentificacion = tipoIdentificacion;
      }
    }

    if (typeof payload.numeroIdentificacion === 'number' || typeof payload.numeroIdentificacion === 'string') {
      const numeroIdentificacion = Number(payload.numeroIdentificacion);
      if (Number.isFinite(numeroIdentificacion)) {
        campos.numeroIdentificacion = numeroIdentificacion;
      }
    }

    const responsableCorrectivo = (() => {
      if (typeof payload.nombresResponsable === 'string' && payload.nombresResponsable.trim() !== '') {
        return payload.nombresResponsable.trim();
      }
      if (typeof payload.nombreIngeniero === 'string' && payload.nombreIngeniero.trim() !== '') {
        return payload.nombreIngeniero.trim();
      }
      return null;
    })();

    if (responsableCorrectivo) {
      campos.nombresResponsable = responsableCorrectivo;
    }

    if (typeof payload.detalleActividades === 'string') {
      campos.detalleActividades = payload.detalleActividades.trim();
    }

    if (typeof payload.placa === 'string' && payload.placa.trim() !== '') {
      campos.placa = payload.placa.trim().toUpperCase();
    }

    if (Object.keys(campos).length > 0) {
      await TblCorrectivo.query().where('id', detalleId).update(campos);
    }
  }

  private async actualizarAlistamientoLocal(detalleId: number | null, payload: Record<string, any>): Promise<void> {
    if (!detalleId) {
      return;
    }

    const campos: Record<string, any> = {};

    if (typeof payload.placa === 'string' && payload.placa.trim() !== '') {
      campos.placa = payload.placa.trim().toUpperCase();
    }

    const camposNumericos: Array<{ llave: keyof TblAlistamiento; origen: string }> = [
      { llave: 'tipoIdentificacionResponsable', origen: 'tipoIdentificacionResponsable' },
      { llave: 'numeroIdentificacionResponsable', origen: 'numeroIdentificacionResponsable' },
      { llave: 'tipoIdentificacionConductor', origen: 'tipoIdentificacionConductor' },
      { llave: 'numeroIdentificacionConductor', origen: 'numeroIdentificacionConductor' },
    ];

    for (const campo of camposNumericos) {
      const valor = (payload as any)[campo.origen];
      if (valor === undefined || valor === null) {
        continue;
      }
      const numero = Number(valor);
      if (Number.isFinite(numero)) {
        campos[campo.llave] = numero;
      }
    }

    if (typeof payload.nombreResponsable === 'string') {
      campos.nombreResponsable = payload.nombreResponsable.trim();
    }

    if (typeof payload.nombresConductor === 'string') {
      campos.nombresConductor = payload.nombresConductor.trim();
    }

    if (typeof payload.detalleActividades === 'string') {
      campos.detalleActividades = payload.detalleActividades.trim();
    }

    if (Object.keys(campos).length > 0) {
      await TblAlistamiento.query().where('id', detalleId).update(campos);
    }

    if (payload.actividades !== undefined) {
      const actividades = this.normalizarActividades(payload.actividades);
      await TblDetallesAlistamientoActividades.query().where('alistamientoId', detalleId).delete();
      if (actividades.length > 0) {
        await TblDetallesAlistamientoActividades.createMany(
          actividades.map((actividad) => ({
            alistamientoId: detalleId,
            actividadId: actividad.id,
            estado: actividad.estado,
          }))
        );
      }
    }
  }

  private async actualizarAutorizacionLocal(detalleId: number | null, payload: Record<string, any>): Promise<void> {
    if (!detalleId) {
      return;
    }

    const campos: Record<string, any> = {};
    if (typeof payload.fechaViaje === 'string' || payload.fechaViaje instanceof Date) {
      const fecha = payload.fechaViaje instanceof Date ? payload.fechaViaje : new Date(payload.fechaViaje);
      if (!Number.isNaN(fecha.getTime())) {
        campos.fechaViaje = fecha;
      }
    }

    const camposTexto = [
      'origen',
      'destino',
      'nombresApellidosNna',
      'situacionDiscapacidad',
      'perteneceComunidadEtnica',
      'nombresApellidosOtorgante',
      'correoElectronicoOtorgante',
      'direccionFisicaOtorgante',
      'nombresApellidosAutorizadoViajar',
      'direccionFisicaAutorizadoViajar',
      'nombresApellidosAutorizadoRecoger',
      'direccionFisicaAutorizadoRecoger',
      'copiaAutorizacionViajeNombreOriginal',
      'copiaAutorizacionViajeDocumento',
      'copiaAutorizacionViajeRuta',
      'copiaDocumentoParentescoNombreOriginal',
      'copiaDocumentoParentescoDocumento',
      'copiaDocumentoParentescoRuta',
      'copiaDocumentoIdentidadAutorizadoNombreOriginal',
      'copiaDocumentoIdentidadAutorizadoDocumento',
      'copiaDocumentoIdentidadAutorizadoRuta',
      'copiaConstanciaEntregaNombreOriginal',
      'copiaConstanciaEntregaDocumento',
      'copiaConstanciaEntregaRuta',
    ];

    for (const campo of camposTexto) {
      const valor = (payload as any)[campo];
      if (typeof valor === 'string') {
        campos[campo] = valor.trim();
      }
    }

    const camposNumericos = [
      'tipoIdentificacionNna',
      'numeroIdentificacionNna',
      'tipoDiscapacidad',
      'tipoPoblacionEtnica',
      'tipoIdentificacionOtorgante',
      'numeroIdentificacionOtorgante',
      'numeroTelefonicoOtorgante',
      'sexoOtorgante',
      'generoOtorgante',
      'calidadActua',
      'tipoIdentificacionAutorizadoViajar',
      'numeroIdentificacionAutorizadoViajar',
      'numeroTelefonicoAutorizadoViajar',
      'tipoIdentificacionAutorizadoRecoger',
      'numeroIdentificacionAutorizadoRecoger',
      'numeroTelefonicoAutorizadoRecoger',
    ];

    for (const campo of camposNumericos) {
      const valor = (payload as any)[campo];
      if (valor === undefined || valor === null) {
        continue;
      }
      const numero = Number(valor);
      if (Number.isFinite(numero)) {
        campos[campo] = numero;
      }
    }

    if (Object.keys(campos).length > 0) {
      await TblAutorizaciones.query().where('id', detalleId).update(campos);
    }
  }

  private async marcarJobComoProcesado(job: TblMantenimientoJob): Promise<void> {
    job.estado = 'procesado';
    job.ultimoError = null;
    job.siguienteIntento = this.getColombiaDateTime();
    await job.save();
  }

  private prepararReprogramacion(job: TblMantenimientoJob): void {
    job.estado = 'pendiente';
    job.reintentos = 0;
    job.ultimoError = null;
    job.siguienteIntento = this.getColombiaDateTime();
  }

  /**
   * Obtiene los datos de autenticación según el rol del usuario
   */
  private async obtenerDatosAutenticacion(usuario: string, idRol: number): Promise<{tokenAutorizacion: string, nitVigilado: any, usuarioId: number}> {
    let tokenAutorizacion = '';
    let nitVigilado;
    let usuarioId = 0;

    const usuarioDb = await TblUsuarios.query().where('identificacion', usuario).first();

    if (!usuarioDb) {
      throw new Exception("Usuario no encontrado", 404);
    }

    if (idRol == 3) {
      nitVigilado = usuarioDb.administrador!;
      const usuarioAdministrador = await TblUsuarios.query().where('identificacion', usuarioDb.administrador!).first();
      if (!usuarioAdministrador) {
        throw new Exception("Usuario administrador no encontrado", 404);
      }
      tokenAutorizacion = usuarioAdministrador.tokenAutorizado || '';
      usuarioId = usuarioAdministrador.id!;
    } else if (idRol == 2 || idRol == 1) {
      nitVigilado = usuarioDb.identificacion!;
      tokenAutorizacion = usuarioDb.tokenAutorizado || '';
      usuarioId = usuarioDb.id!;
    }


    // Validar que el token no esté vacío
    if (!tokenAutorizacion || tokenAutorizacion.trim() === '') {
      throw new Exception("Token de autorización no encontrado. Por favor, contacte al administrador.", 400);
    }

    return { tokenAutorizacion, nitVigilado, usuarioId };
  }

  async listarPlacas(tipoId: number, usuario: string, idRol: number): Promise<any[]> {
    try {
      const tokenExterno = await this.validarTokenExterno();

      const { tokenAutorizacion, nitVigilado } = await this.obtenerDatosAutenticacion(usuario, idRol);

      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaArchivosPrograma = await axios.get(
          `${urlMantenimientos}/mantenimiento/listar-placas?vigiladoId=${nitVigilado}&tipoId=${tipoId}`,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'Content-Type': 'application/json'
            }
          }
        );

        return respuestaArchivosPrograma.data;
      } catch (errorExterno: any) {
        console.error("Error al enviar datos al API externo de mantenimiento:", errorExterno);
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de mantenimiento",
          errorExterno.response?.status || 500
        );
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  async guardarMantenimiento(datos: any, usuario: string, idRol: number, proveedorId?: string, opciones?: OpcionesSincronizacion): Promise<any> {
    try {
      const asyncMode = opciones?.diferido === true;

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      const { vigiladoId, placa, tipoId } = datos;
      const fechaCreacion = this.getColombiaDateTime();
      const mantenimientoDTO = {
        placa,
        usuarioId: nitVigilado,
        tipoId,
        createdAt: fechaCreacion,
        fechaDiligenciamiento: fechaCreacion,
        procesado: false,
        mantenimientoId: null,
      };
      if (tipoId != 4) {
        await TblMantenimiento.query()
          .where("usuarioId", nitVigilado)
          .where("placa", placa)
          .where("tipoId", tipoId)
          .update({ estado: false });
      }

      const mantenimiento = await TblMantenimiento.create(mantenimientoDTO);

      if (asyncMode) {
        const job = await this.crearJob({
          tipo: 'base',
          mantenimientoLocalId: mantenimiento.id ?? null,
          detalleId: null,
          vigiladoId: String(vigiladoId ?? nitVigilado ?? ''),
          usuario,
          rolId: idRol,
          payload: {
            vigiladoId,
            placa,
            tipoId,
          },
        });

        return {
          mensaje: 'Mantenimiento programado para sincronización',
          mantenimientoLocalId: mantenimiento.id,
          jobId: job.id,
        };
      }

      const tokenExterno = await this.validarTokenExterno();

      // Enviar datos al API externo de mantenimiento
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const datosMantenimiento = {
          vigiladoId: parseInt(nitVigilado),
          placa,
          tipoId
        };

        const respuestaMantenimiento = await axios.post(
          `${urlMantenimientos}/mantenimiento/guardar-mantenimieto`,
          datosMantenimiento,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'Content-Type': 'application/json'
            }
          }
        );

        // Si la respuesta es exitosa (200 o 201), actualizar el campo procesado y guardar el ID en mantenimientoId
        if ((respuestaMantenimiento.status === 200 || respuestaMantenimiento.status === 201) && mantenimiento.id) {
          const mantenimientoIdExterno = respuestaMantenimiento.data?.id || respuestaMantenimiento.data?.data?.id;
          await this.marcarMantenimientoProcesado({
            mantenimientoLocalId: mantenimiento.id,
            mantenimientoIdExterno: mantenimientoIdExterno ?? null
          });
          mantenimiento.mantenimientoId = mantenimientoIdExterno ?? null;
          mantenimiento.procesado = true;
        }

        // Retornar la respuesta del API externo
        return respuestaMantenimiento.data;
      } catch (errorExterno: any) {
        this.convertirErrorExterno(errorExterno, "Error al comunicarse con el servicio externo de mantenimiento");
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudo guardar el mantenimiento");
    }
  }

  async guardarPreventivo(datos: any, usuario: string, idRol: number, opciones?: OpcionesSincronizacion): Promise<any> {
    const {
      placa,
      fecha,
      hora,
      nit,
      razonSocial,
      tipoIdentificacion,
      numeroIdentificacion,
      nombresResponsable,
      mantenimientoId,
      detalleActividades,
    } = datos;
    try {
      const asyncMode = opciones?.diferido === true;

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // 1. Guardar localmente primero
      const fechaISO = fecha
        ? DateTime.fromISO(String(fecha), { zone: 'utc' }).toISODate()
        : null;

      console.log('[Preventivo local] entrada:', { fechaOriginal: fecha, fechaISO });

      const preventivoDTO = {
        placa,
        fecha: fechaISO ?? fecha,
        hora,
        nit,
        razonSocial,
        tipoIdentificacion,
        numeroIdentificacion,
        nombresResponsable,
        mantenimientoId,
        detalleActividades,
        procesado: false
      };
      const preventivo = await TblPreventivo.create(preventivoDTO);

      console.log('[Preventivo local] guardado:', {
        preventivoId: preventivo.id,
        fechaPersistida: preventivo.fecha,
        fechaDTO: preventivoDTO.fecha,
      });

      if (asyncMode) {
        const mantenimientoLocal = await TblMantenimiento.find(mantenimientoId);

        if (!mantenimientoLocal) {
          throw new Exception('Mantenimiento local no encontrado para programar preventivo', 404);
        }

        const job = await this.crearJob({
          tipo: 'preventivo',
          mantenimientoLocalId: mantenimientoLocal.id ?? null,
          detalleId: preventivo.id ?? null,
          vigiladoId: String(mantenimientoLocal.usuarioId ?? nitVigilado ?? ''),
          usuario,
          rolId: idRol,
          payload: {
            placa,
            fecha,
            hora,
            nit,
            razonSocial,
            tipoIdentificacion,
            numeroIdentificacion,
            nombresResponsable,
            detalleActividades,
          }
        });

        return {
          mensaje: 'Preventivo programado para sincronización',
          preventivoId: preventivo.id,
          mantenimientoLocalId: mantenimientoLocal.id,
          jobId: job.id,
        };
      }

      const tokenExterno = await this.validarTokenExterno();

      // 2. Enviar datos al API externo de mantenimiento preventivo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const datosPreventivo = {
          fecha: fechaISO ?? fecha,
          hora,
          nit,
          razonSocial,
          tipoIdentificacion,
          numeroIdentificacion,
          nombresResponsable,
          mantenimientoId,
          detalleActividades
        };

        console.log('[Preventivo externo] fecha local:', fecha, 'normalizada:', fechaISO ?? fecha);

        const respuestaPreventivo = await axios.post(
          `${urlMantenimientos}/mantenimiento/guardar-preventivo`,
          datosPreventivo,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado,
              'Content-Type': 'application/json'
            }
          }
        );

        // 3. Si la respuesta es exitosa (200 o 201), actualizar el campo procesado y mantenimientoId
        if ((respuestaPreventivo.status === 200 || respuestaPreventivo.status === 201) && preventivo.id) {
          const mantenimientoIdExterno = respuestaPreventivo.data?.mantenimiento_id || respuestaPreventivo.data?.mantenimientoId || respuestaPreventivo.data?.data?.mantenimientoId;
          await TblPreventivo.query()
            .where("id", preventivo.id)
            .update({
              procesado: true,
              mantenimientoId: mantenimientoIdExterno || mantenimientoId
            });
          await this.marcarMantenimientoProcesado({
            mantenimientoLocalId: Number(mantenimientoId),
            mantenimientoIdExterno: mantenimientoIdExterno ?? null
          });
        }

        // Retornar la respuesta del API externo
        return respuestaPreventivo.data;
      } catch (errorExterno: any) {
        this.convertirErrorExterno(errorExterno, "Error al comunicarse con el servicio externo de mantenimiento preventivo");
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudo guardar el mantenimiento preventivo");
    }
  }

  async guardarCorrectivo(datos: any, usuario: string, idRol: number, opciones?: OpcionesSincronizacion): Promise<any> {
    const {
      placa,
      fecha,
      hora,
      nit,
      razonSocial,
      tipoIdentificacion,
      numeroIdentificacion,
      nombresResponsable,
      mantenimientoId,
      detalleActividades,
    } = datos;
    try {
      const asyncMode = opciones?.diferido === true;

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // 1. Guardar localmente primero
      const fechaISO = fecha
        ? DateTime.fromISO(String(fecha), { zone: 'utc' }).toISODate()
        : null;

      const correctivoDTO = {
        placa,
        fecha: fechaISO ?? fecha,
        hora,
        nit,
        razonSocial,
        tipoIdentificacion,
        numeroIdentificacion,
        nombresResponsable,
        mantenimientoId,
        detalleActividades,
        procesado: false
      };
      const correctivo = await TblCorrectivo.create(correctivoDTO);

      console.log('[Correctivo local] guardado:', {
        correctivoId: correctivo.id,
        fechaPersistida: correctivo.fecha,
        fechaDTO: correctivoDTO.fecha,
      });

      if (asyncMode) {
        const mantenimientoLocal = await TblMantenimiento.find(mantenimientoId);

        if (!mantenimientoLocal) {
          throw new Exception('Mantenimiento local no encontrado para programar correctivo', 404);
        }

        const job = await this.crearJob({
          tipo: 'correctivo',
          mantenimientoLocalId: mantenimientoLocal.id ?? null,
          detalleId: correctivo.id ?? null,
          vigiladoId: String(mantenimientoLocal.usuarioId ?? nitVigilado ?? ''),
          usuario,
          rolId: idRol,
          payload: {
            placa,
            fecha,
            hora,
            nit,
            razonSocial,
            tipoIdentificacion,
            numeroIdentificacion,
            nombresResponsable,
            detalleActividades,
          }
        });

        return {
          mensaje: 'Correctivo programado para sincronización',
          correctivoId: correctivo.id,
          mantenimientoLocalId: mantenimientoLocal.id,
          jobId: job.id,
        };
      }

      // 2. Enviar datos al API externo de mantenimiento correctivo
      try {
        const tokenExterno = await this.validarTokenExterno();
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const datosCorrectivo = {
          fecha: fechaISO ?? fecha,
          hora,
          nit,
          razonSocial,
          tipoIdentificacion,
          numeroIdentificacion,
          nombresResponsable,
          mantenimientoId,
          detalleActividades
        };

        console.log('[Correctivo externo] fecha local:', fecha, 'normalizada:', fechaISO ?? fecha);

        const respuestaCorrectivo = await axios.post(
          `${urlMantenimientos}/mantenimiento/guardar-correctivo`,
          datosCorrectivo,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado,
              'Content-Type': 'application/json'
            }
          }
        );

        // 3. Si la respuesta es exitosa (200 o 201), actualizar el campo procesado y mantenimientoId
        if ((respuestaCorrectivo.status === 200 || respuestaCorrectivo.status === 201) && correctivo.id) {
          const mantenimientoIdExterno = respuestaCorrectivo.data?.mantenimiento_id || respuestaCorrectivo.data?.mantenimientoId || respuestaCorrectivo.data?.data?.mantenimientoId;
          await TblCorrectivo.query()
            .where("id", correctivo.id)
            .update({
              procesado: true,
              mantenimientoId: mantenimientoIdExterno || mantenimientoId
            });
          await this.marcarMantenimientoProcesado({
            mantenimientoLocalId: Number(mantenimientoId),
            mantenimientoIdExterno: mantenimientoIdExterno ?? null
          });
        }

        // Retornar la respuesta del API externo
        return respuestaCorrectivo.data;
      } catch (errorExterno: any) {
        this.convertirErrorExterno(errorExterno, "Error al comunicarse con el servicio externo de mantenimiento correctivo");
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudo guardar el mantenimiento correctivo");
    }
  }

  async guardarAlistamiento(datos: any, usuario: string, idRol: number, opciones?: OpcionesSincronizacion): Promise<any> {
    const {
      placa,
      tipoIdentificacionResponsable,
      numeroIdentificacionResponsable,
      nombreResponsable,
      tipoIdentificacionConductor,
      numeroIdentificacionConductor,
      nombresConductor,
      mantenimientoId,
      detalleActividades,
      actividades,
    } = datos;
    try {
      const asyncMode = opciones?.diferido === true;

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      const actividadesNormalizadas = this.normalizarActividades(actividades);
      const actividadesIds = this.actividadesParaApi(actividades);

      // 1. Guardar localmente primero
      const alistamientoDTO = {
        placa,
        tipoIdentificacionResponsable,
        numeroIdentificacionResponsable,
        nombreResponsable,
        tipoIdentificacionConductor,
        numeroIdentificacionConductor,
        nombresConductor,
        mantenimientoId,
        detalleActividades,
        estado: true,
        procesado: false
      };
      const alistamiento = await TblAlistamiento.create(alistamientoDTO);

      // Guardar actividades relacionadas si existen
      if (actividadesNormalizadas.length > 0 && alistamiento.id) {
        const idsAdjuntados = new Set<number>();
        for (const actividad of actividadesNormalizadas) {
          if (idsAdjuntados.has(actividad.id)) {
            continue;
          }
          idsAdjuntados.add(actividad.id);
          await alistamiento.related('actividades').attach({
            [actividad.id]: {
              tda_estado: actividad.estado
            }
          });
        }
      }

      if (asyncMode) {
        const mantenimientoLocal = await TblMantenimiento.find(mantenimientoId);

        if (!mantenimientoLocal) {
          throw new Exception('Mantenimiento local no encontrado para programar alistamiento', 404);
        }

        const job = await this.crearJob({
          tipo: 'alistamiento',
          mantenimientoLocalId: mantenimientoLocal.id ?? null,
          detalleId: alistamiento.id ?? null,
          vigiladoId: String(mantenimientoLocal.usuarioId ?? nitVigilado ?? ''),
          usuario,
          rolId: idRol,
          payload: {
            placa,
            tipoIdentificacionResponsable,
            numeroIdentificacionResponsable,
            nombreResponsable,
            tipoIdentificacionConductor,
            numeroIdentificacionConductor,
            nombresConductor,
            detalleActividades,
            actividades: actividadesIds,
          }
        });

        return {
          mensaje: 'Alistamiento programado para sincronización',
          alistamientoId: alistamiento.id,
          mantenimientoLocalId: mantenimientoLocal.id,
          jobId: job.id,
        };
      }

      // 2. Enviar datos al API externo de alistamiento
      try {
        const tokenExterno = await this.validarTokenExterno();
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const datosAlistamiento = {
          tipoIdentificacionResponsable,
          numeroIdentificacionResponsable,
          nombreResponsable,
          tipoIdentificacionConductor,
          numeroIdentificacionConductor,
          nombresConductor,
          mantenimientoId,
          detalleActividades,
          actividades: actividadesIds
        };

        const respuestaAlistamiento = await axios.post(
          `${urlMantenimientos}/mantenimiento/guardar-alistamiento`,
          datosAlistamiento,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado
            }
          }
        );

        // 3. Si la respuesta es exitosa (200 o 201), actualizar el campo procesado y mantenimientoId
        if ((respuestaAlistamiento.status === 200 || respuestaAlistamiento.status === 201) && alistamiento.id) {
          const mantenimientoIdExterno = respuestaAlistamiento.data?.mantenimiento_id || respuestaAlistamiento.data?.mantenimientoId || respuestaAlistamiento.data?.data?.mantenimientoId;
          await TblAlistamiento.query()
            .where("id", alistamiento.id)
            .update({
              procesado: true,
              mantenimientoId: mantenimientoIdExterno || mantenimientoId
            });
          await this.marcarMantenimientoProcesado({
            mantenimientoLocalId: Number(mantenimientoId),
            mantenimientoIdExterno: mantenimientoIdExterno ?? null
          });
        }

        // Retornar la respuesta del API externo
        return respuestaAlistamiento.data;
      } catch (errorExterno: any) {
        this.convertirErrorExterno(errorExterno, "Error al comunicarse con el servicio externo de alistamiento");
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudo guardar el alistamiento");
    }
  }

  async guardarAutorizacion(datos: any, usuario: string, idRol: number, opciones?: OpcionesSincronizacion): Promise<any> {
    const { mantenimientoId } = datos;
    try {
      const asyncMode = opciones?.diferido === true;

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // 1. Guardar localmente primero (sin los archivos que vienen como FormData)
      const autorizacionDTO = {
        fechaViaje: datos.fechaViaje,
        origen: datos.origen,
        destino: datos.destino,
        tipoIdentificacionNna: datos.tipoIdentificacionNna,
        numeroIdentificacionNna: datos.numeroIdentificacionNna,
        nombresApellidosNna: datos.nombresApellidosNna,
        situacionDiscapacidad: datos.situacionDiscapacidad,
        tipoDiscapacidad: datos.tipoDiscapacidad,
        perteneceComunidadEtnica: datos.perteneceComunidadEtnica,
        tipoPoblacionEtnica: datos.tipoPoblacionEtnica,
        tipoIdentificacionOtorgante: datos.tipoIdentificacionOtorgante,
        numeroIdentificacionOtorgante: datos.numeroIdentificacionOtorgante,
        nombresApellidosOtorgante: datos.nombresApellidosOtorgante,
        numeroTelefonicoOtorgante: datos.numeroTelefonicoOtorgante,
        correoElectronicoOtorgante: datos.correoElectronicoOtorgante,
        direccionFisicaOtorgante: datos.direccionFisicaOtorgante,
        sexoOtorgante: datos.sexoOtorgante,
        generoOtorgante: datos.generoOtorgante,
        calidadActua: datos.calidadActua,
        tipoIdentificacionAutorizadoViajar: datos.tipoIdentificacionAutorizadoViajar,
        numeroIdentificacionAutorizadoViajar: datos.numeroIdentificacionAutorizadoViajar,
        nombresApellidosAutorizadoViajar: datos.nombresApellidosAutorizadoViajar,
        numeroTelefonicoAutorizadoViajar: datos.numeroTelefonicoAutorizadoViajar,
        direccionFisicaAutorizadoViajar: datos.direccionFisicaAutorizadoViajar,
        tipoIdentificacionAutorizadoRecoger: datos.tipoIdentificacionAutorizadoRecoger,
        numeroIdentificacionAutorizadoRecoger: datos.numeroIdentificacionAutorizadoRecoger,
        nombresApellidosAutorizadoRecoger: datos.nombresApellidosAutorizadoRecoger,
        numeroTelefonicoAutorizadoRecoger: datos.numeroTelefonicoAutorizadoRecoger,
        direccionFisicaAutorizadoRecoger: datos.direccionFisicaAutorizadoRecoger,
        copiaAutorizacionViajeNombreOriginal: datos.copiaAutorizacionViajeNombreOriginal,
        copiaAutorizacionViajeDocumento: datos.copiaAutorizacionViajeDocumento,
        copiaAutorizacionViajeRuta: datos.copiaAutorizacionViajeRuta,
        copiaDocumentoParentescoNombreOriginal: datos.copiaDocumentoParentescoNombreOriginal,
        copiaDocumentoParentescoDocumento: datos.copiaDocumentoParentescoDocumento,
        copiaDocumentoParentescoRuta: datos.copiaDocumentoParentescoRuta,
        copiaDocumentoIdentidadAutorizadoNombreOriginal: datos.copiaDocumentoIdentidadAutorizadoNombreOriginal,
        copiaDocumentoIdentidadAutorizadoDocumento: datos.copiaDocumentoIdentidadAutorizadoDocumento,
        copiaDocumentoIdentidadAutorizadoRuta: datos.copiaDocumentoIdentidadAutorizadoRuta,
        copiaConstanciaEntregaNombreOriginal: datos.copiaConstanciaEntregaNombreOriginal,
        copiaConstanciaEntregaDocumento: datos.copiaConstanciaEntregaDocumento,
        copiaConstanciaEntregaRuta: datos.copiaConstanciaEntregaRuta,
        mantenimientoId,
        estado: true
      };
      const autorizacion = await TblAutorizaciones.create(autorizacionDTO);

      if (asyncMode) {
        const mantenimientoLocal = await TblMantenimiento.find(mantenimientoId);

        if (!mantenimientoLocal) {
          throw new Exception('Mantenimiento local no encontrado para programar autorización', 404);
        }

        const job = await this.crearJob({
          tipo: 'autorizacion',
          mantenimientoLocalId: mantenimientoLocal.id ?? null,
          detalleId: autorizacion.id ?? null,
          vigiladoId: String(mantenimientoLocal.usuarioId ?? nitVigilado ?? ''),
          usuario,
          rolId: idRol,
          payload: datos,
        });

        return {
          mensaje: 'Autorización programada para sincronización',
          autorizacionId: autorizacion.id,
          mantenimientoLocalId: mantenimientoLocal.id,
          jobId: job.id,
        };
      }

      // 2. Enviar datos al API externo de autorización
      try {
        const tokenExterno = await this.validarTokenExterno();
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaAutorizacion = await axios.post(
          `${urlMantenimientos}/mantenimiento/guardar-autorizacion`,
          datos,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado,
              'Content-Type': 'application/json'
            }
          }
        );

        // 3. Si la respuesta es exitosa (200 o 201), actualizar el mantenimiento como procesado y el mantenimientoId en autorizacion
        if ((respuestaAutorizacion.status === 200 || respuestaAutorizacion.status === 201) && mantenimientoId && autorizacion.id) {
          const mantenimientoIdExterno = respuestaAutorizacion.data?.mantenimiento_id || respuestaAutorizacion.data?.mantenimientoId || respuestaAutorizacion.data?.data?.mantenimientoId;

          await TblAutorizaciones.query()
            .where("id", autorizacion.id)
            .update({ mantenimientoId: mantenimientoIdExterno || mantenimientoId });

          await this.marcarMantenimientoProcesado({
            mantenimientoLocalId: Number(mantenimientoId),
            mantenimientoIdExterno: mantenimientoIdExterno ?? null
          });
        }

        // Retornar la respuesta del API externo
        return respuestaAutorizacion.data;
      } catch (errorExterno: any) {
        this.convertirErrorExterno(errorExterno, "Error al comunicarse con el servicio externo de autorización");
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudo guardar la autorizacion");
    }
  }

  public async procesarJob(job: TblMantenimientoJob): Promise<void> {
    switch (job.tipo) {
      case 'base':
        await this.procesarJobMantenimientoBase(job);
        break;
      case 'preventivo':
        await this.procesarJobPreventivo(job);
        break;
      case 'correctivo':
        await this.procesarJobCorrectivo(job);
        break;
      case 'alistamiento':
        await this.procesarJobAlistamiento(job);
        break;
      case 'autorizacion':
        await this.procesarJobAutorizacion(job);
        break;
      default:
        throw new Exception(`Tipo de trabajo no soportado: ${job.tipo}`, 400);
    }
  }

  private async procesarJobMantenimientoBase(job: TblMantenimientoJob): Promise<void> {
    if (!job.mantenimientoLocalId) {
      throw new Exception('El trabajo no referencia un mantenimiento local válido', 400);
    }

    const mantenimiento = await TblMantenimiento.find(job.mantenimientoLocalId);

    if (!mantenimiento) {
      throw new Exception('Mantenimiento local no encontrado', 404);
    }

    const payload = job.payload || {};
    const vigiladoId = payload.vigiladoId ?? mantenimiento.usuarioId;
    const placa = payload.placa ?? mantenimiento.placa;
    const tipoId = payload.tipoId ?? mantenimiento.tipoId;

    const tokenExterno = await this.validarTokenExterno();

    const { tokenAutorizacion } = await this.obtenerDatosAutenticacion(job.usuarioDocumento, job.rolId);
    const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

    const vigiladoIdNormalizado = Number(vigiladoId);

    const datosMantenimiento = {
      vigiladoId: Number.isNaN(vigiladoIdNormalizado) ? vigiladoId : vigiladoIdNormalizado,
      placa,
      tipoId
    };

    try {
      const respuesta = await axios.post(
        `${urlMantenimientos}/mantenimiento/guardar-mantenimieto`,
        datosMantenimiento,
        {
          headers: {
            'Authorization': `Bearer ${tokenExterno}`,
            'token': tokenAutorizacion,
            'Content-Type': 'application/json'
          }
        }
      );

      if ((respuesta.status === 200 || respuesta.status === 201) && mantenimiento.id) {
        const mantenimientoIdExterno = respuesta.data?.id
          ?? respuesta.data?.mantenimientoId
          ?? respuesta.data?.mantenimiento_id
          ?? respuesta.data?.data?.id
          ?? respuesta.data?.data?.mantenimientoId
          ?? respuesta.data?.data?.mantenimiento_id;

        if (mantenimientoIdExterno === null || mantenimientoIdExterno === undefined || mantenimientoIdExterno === '') {
          const mensajeApi = typeof respuesta.data?.mensaje === 'string' && respuesta.data.mensaje.trim() !== ''
            ? respuesta.data.mensaje.trim()
            : typeof respuesta.data?.message === 'string' && respuesta.data.message.trim() !== ''
              ? respuesta.data.message.trim()
              : 'El servicio externo no devolvió el identificador del mantenimiento';
          const error = new Exception(mensajeApi, respuesta.data?.codigo || respuesta.status || 500);
          (error as any).responseData = respuesta.data;
          throw error;
        }

        await this.marcarMantenimientoProcesado({
          mantenimientoLocalId: mantenimiento.id,
          mantenimientoIdExterno: Number.isNaN(Number(mantenimientoIdExterno)) ? mantenimientoIdExterno : Number(mantenimientoIdExterno)
        });
      }
    } catch (errorExterno: any) {
      this.convertirErrorExterno(errorExterno, 'Error al comunicarse con el servicio externo de mantenimiento');
    }
  }

  private async procesarJobPreventivo(job: TblMantenimientoJob): Promise<void> {
    if (!job.detalleId) {
      throw new Exception('El trabajo de preventivo no contiene detalle asociado', 400);
    }

    const preventivo = await TblPreventivo.find(job.detalleId);

    if (!preventivo) {
      throw new Exception('Registro preventivo no encontrado', 404);
    }

    const mantenimiento = await TblMantenimiento.find(job.mantenimientoLocalId ?? preventivo.mantenimientoId);

    if (!mantenimiento) {
      throw new Exception('Mantenimiento local asociado no encontrado', 404);
    }

    if (!mantenimiento.mantenimientoId) {
      throw new MantenimientoPendienteError('El mantenimiento base aún no ha sido sincronizado');
    }

    const tokenExterno = await this.validarTokenExterno();

    const { tokenAutorizacion, nitVigilado } = await this.obtenerDatosAutenticacion(job.usuarioDocumento, job.rolId);
    const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

    const datosPreventivo = {
      fecha: this.normalizarFechaParaEnvio(preventivo.fecha),
      hora: preventivo.hora,
      nit: preventivo.nit,
      razonSocial: preventivo.razonSocial,
      tipoIdentificacion: preventivo.tipoIdentificacion,
      numeroIdentificacion: preventivo.numeroIdentificacion,
      nombresResponsable: preventivo.nombresResponsable,
      mantenimientoId: mantenimiento.mantenimientoId,
      detalleActividades: preventivo.detalleActividades
    };

    try {
      console.log('[Job Preventivo externo]', {
        jobId: job.id,
        fechaLocal: preventivo.fecha,
        fechaNormalizada: datosPreventivo.fecha,
      });
      const respuesta = await axios.post(
        `${urlMantenimientos}/mantenimiento/guardar-preventivo`,
        datosPreventivo,
        {
          headers: {
            'Authorization': `Bearer ${tokenExterno}`,
            'token': tokenAutorizacion,
            'vigiladoId': nitVigilado,
            'Content-Type': 'application/json'
          }
        }
      );

      if ((respuesta.status === 200 || respuesta.status === 201) && preventivo.id) {
        const mantenimientoIdExterno = respuesta.data?.mantenimiento_id || respuesta.data?.mantenimientoId || respuesta.data?.data?.mantenimientoId || mantenimiento.mantenimientoId;
        await TblPreventivo.query()
          .where('id', preventivo.id)
          .update({
            procesado: true,
            mantenimientoId: mantenimientoIdExterno
          });
      }
    } catch (errorExterno: any) {
      this.convertirErrorExterno(errorExterno, 'Error al comunicarse con el servicio externo de mantenimiento preventivo');
    }
  }

  private async procesarJobCorrectivo(job: TblMantenimientoJob): Promise<void> {
    if (!job.detalleId) {
      throw new Exception('El trabajo de correctivo no contiene detalle asociado', 400);
    }

    const correctivo = await TblCorrectivo.find(job.detalleId);

    if (!correctivo) {
      throw new Exception('Registro correctivo no encontrado', 404);
    }

    const mantenimiento = await TblMantenimiento.find(job.mantenimientoLocalId ?? correctivo.mantenimientoId);

    if (!mantenimiento) {
      throw new Exception('Mantenimiento local asociado no encontrado', 404);
    }

    if (!mantenimiento.mantenimientoId) {
      throw new MantenimientoPendienteError('El mantenimiento base aún no ha sido sincronizado');
    }

    const tokenExterno = await this.validarTokenExterno();

    const { tokenAutorizacion, nitVigilado } = await this.obtenerDatosAutenticacion(job.usuarioDocumento, job.rolId);
    const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

    const datosCorrectivo = {
      fecha: this.normalizarFechaParaEnvio(correctivo.fecha),
      hora: correctivo.hora,
      nit: correctivo.nit,
      razonSocial: correctivo.razonSocial,
      tipoIdentificacion: correctivo.tipoIdentificacion,
      numeroIdentificacion: correctivo.numeroIdentificacion,
      nombresResponsable: correctivo.nombresResponsable,
      mantenimientoId: mantenimiento.mantenimientoId,
      detalleActividades: correctivo.detalleActividades
    };

    try {
      console.log('[Job Correctivo externo]', {
        jobId: job.id,
        fechaLocal: correctivo.fecha,
        fechaNormalizada: datosCorrectivo.fecha,
      });
      const respuesta = await axios.post(
        `${urlMantenimientos}/mantenimiento/guardar-correctivo`,
        datosCorrectivo,
        {
          headers: {
            'Authorization': `Bearer ${tokenExterno}`,
            'token': tokenAutorizacion,
            'vigiladoId': nitVigilado,
            'Content-Type': 'application/json'
          }
        }
      );

      if ((respuesta.status === 200 || respuesta.status === 201) && correctivo.id) {
        const mantenimientoIdExterno = respuesta.data?.mantenimiento_id || respuesta.data?.mantenimientoId || respuesta.data?.data?.mantenimientoId || mantenimiento.mantenimientoId;
        await TblCorrectivo.query()
          .where('id', correctivo.id)
          .update({
            procesado: true,
            mantenimientoId: mantenimientoIdExterno
          });
      }
    } catch (errorExterno: any) {
      this.convertirErrorExterno(errorExterno, 'Error al comunicarse con el servicio externo de mantenimiento correctivo');
    }
  }

  private async procesarJobAlistamiento(job: TblMantenimientoJob): Promise<void> {
    if (!job.detalleId) {
      throw new Exception('El trabajo de alistamiento no contiene detalle asociado', 400);
    }

    const alistamiento = await TblAlistamiento.find(job.detalleId);

    if (!alistamiento) {
      throw new Exception('Registro de alistamiento no encontrado', 404);
    }

    const mantenimiento = await TblMantenimiento.find(job.mantenimientoLocalId ?? alistamiento.mantenimientoId);

    if (!mantenimiento) {
      throw new Exception('Mantenimiento local asociado no encontrado', 404);
    }

    if (!mantenimiento.mantenimientoId) {
      throw new MantenimientoPendienteError('El mantenimiento base aún no ha sido sincronizado');
    }

    const tokenExterno = await this.validarTokenExterno();

    const { tokenAutorizacion, nitVigilado } = await this.obtenerDatosAutenticacion(job.usuarioDocumento, job.rolId);
    const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

    const actividadesRelacionadas = await TblDetallesAlistamientoActividades.query()
      .where('tda_alistamiento_id', alistamiento.id ?? 0);

    let actividades = actividadesRelacionadas.map((actividad) => ({
      id: actividad.actividadId,
      estado: actividad.estado
    }));

    if (actividades.length === 0) {
      actividades = this.normalizarActividades(job.payload?.actividades ?? []);
    }

    const actividadesIds = this.actividadesParaApi(actividades);

    const datosAlistamiento = {
      tipoIdentificacionResponsable: alistamiento.tipoIdentificacionResponsable,
      numeroIdentificacionResponsable: alistamiento.numeroIdentificacionResponsable,
      nombreResponsable: alistamiento.nombreResponsable,
      tipoIdentificacionConductor: alistamiento.tipoIdentificacionConductor,
      numeroIdentificacionConductor: alistamiento.numeroIdentificacionConductor,
      nombresConductor: alistamiento.nombresConductor,
      mantenimientoId: mantenimiento.mantenimientoId,
      detalleActividades: alistamiento.detalleActividades,
      actividades: actividadesIds,
    };

    try {
      const respuesta = await axios.post(
        `${urlMantenimientos}/mantenimiento/guardar-alistamiento`,
        datosAlistamiento,
        {
          headers: {
            'Authorization': `Bearer ${tokenExterno}`,
            'token': tokenAutorizacion,
            'vigiladoId': nitVigilado
          }
        }
      );

      if ((respuesta.status === 200 || respuesta.status === 201) && alistamiento.id) {
        const mantenimientoIdExterno = respuesta.data?.mantenimiento_id || respuesta.data?.mantenimientoId || respuesta.data?.data?.mantenimientoId || mantenimiento.mantenimientoId;
        await TblAlistamiento.query()
          .where('id', alistamiento.id)
          .update({
            procesado: true,
            mantenimientoId: mantenimientoIdExterno
          });
      }
    } catch (errorExterno: any) {
      this.convertirErrorExterno(errorExterno, 'Error al comunicarse con el servicio externo de alistamiento');
    }
  }

  private async procesarJobAutorizacion(job: TblMantenimientoJob): Promise<void> {
    if (!job.detalleId) {
      throw new Exception('El trabajo de autorización no contiene detalle asociado', 400);
    }

    const autorizacion = await TblAutorizaciones.find(job.detalleId);

    if (!autorizacion) {
      throw new Exception('Registro de autorización no encontrado', 404);
    }

    const mantenimiento = await TblMantenimiento.find(job.mantenimientoLocalId ?? autorizacion.mantenimientoId);

    if (!mantenimiento) {
      throw new Exception('Mantenimiento local asociado no encontrado', 404);
    }

    const tokenExterno = await this.validarTokenExterno();

    const { tokenAutorizacion, nitVigilado } = await this.obtenerDatosAutenticacion(job.usuarioDocumento, job.rolId);
    const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

    const datosAutorizacion = job.payload ?? autorizacion.toJSON();
    datosAutorizacion.mantenimientoId = mantenimiento.mantenimientoId ?? mantenimiento.id;

    try {
      const respuesta = await axios.post(
        `${urlMantenimientos}/mantenimiento/guardar-autorizacion`,
        datosAutorizacion,
        {
          headers: {
            'Authorization': `Bearer ${tokenExterno}`,
            'token': tokenAutorizacion,
            'vigiladoId': nitVigilado,
            'Content-Type': 'application/json'
          }
        }
      );

      if ((respuesta.status === 200 || respuesta.status === 201) && autorizacion.id) {
        const mantenimientoIdExterno = respuesta.data?.mantenimiento_id || respuesta.data?.mantenimientoId || respuesta.data?.data?.mantenimientoId || mantenimiento.mantenimientoId;

        await TblMantenimiento.query()
          .where('id', mantenimiento.id ?? 0)
          .update({ procesado: true, mantenimientoId: mantenimientoIdExterno });

        await TblAutorizaciones.query()
          .where('id', autorizacion.id)
          .update({ mantenimientoId: mantenimientoIdExterno });
      }
    } catch (errorExterno: any) {
      this.convertirErrorExterno(errorExterno, 'Error al comunicarse con el servicio externo de autorización');
    }
  }

  async visualizarPreventivo(mantenimientoId: number, usuario: string, idRol: number): Promise<any> {
    try {
      const tokenExterno = await this.validarTokenExterno();

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // Consultar el API externo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaPreventivo = await axios.get(
          `${urlMantenimientos}/mantenimiento/visualizar-preventivo?mantenimientoId=${mantenimientoId}`,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado
            }
          }
        );

        return respuestaPreventivo.data;
      } catch (errorExterno: any) {
        console.error("Error al consultar el API externo de mantenimiento preventivo:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de mantenimiento preventivo",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  async visualizarCorrectivo(mantenimientoId: number, usuario: string, idRol: number): Promise<any> {
    try {
      const tokenExterno = await this.validarTokenExterno();

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // Consultar el API externo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaCorrectivo = await axios.get(
          `${urlMantenimientos}/mantenimiento/visualizar-correctivo?mantenimientoId=${mantenimientoId}`,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado
            }
          }
        );

        return respuestaCorrectivo.data;
      } catch (errorExterno: any) {
        console.error("Error al consultar el API externo de mantenimiento correctivo:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de mantenimiento correctivo",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  async visualizarAlistamiento(mantenimientoId: number, usuario: string, idRol: number): Promise<any> {
    try {
      const tokenExterno = await this.validarTokenExterno();

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // Consultar el API externo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaAlistamiento = await axios.get(
          `${urlMantenimientos}/mantenimiento/visualizar-alistamiento?mantenimientoId=${mantenimientoId}`,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado
            }
          }
        );

        return respuestaAlistamiento.data;
      } catch (errorExterno: any) {
        console.error("Error al consultar el API externo de alistamiento:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de alistamiento",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de alistamiento"
      );
    }
  }

  async visualizarAutorizacion(mantenimientoId: number, usuario: string, idRol: number): Promise<any> {
    try {
      const tokenExterno = await this.validarTokenExterno();

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // Consultar el API externo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaAutorizacion = await axios.get(
          `${urlMantenimientos}/mantenimiento/visualizar-autorizacion?mantenimientoId=${mantenimientoId}`,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado
            }
          }
        );

        return respuestaAutorizacion.data;
      } catch (errorExterno: any) {
        console.error("Error al consultar el API externo de autorización:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de autorización",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de alistamiento"
      );
    }
  }

  async listarHistorial(
    tipoId: number,
    vigiladoId: string,
    placa: string,
   idRol: number
  ): Promise<any[]> {
    try {
      const tokenExterno = await this.validarTokenExterno();

      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(vigiladoId, idRol);

      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

      /*   // Obtener el usuario para conseguir el token de autorización
        const usuarioDb = await TblUsuarios.query().where('identificacion', vigiladoId).first();
        if (!usuarioDb) {
          throw new Exception("Usuario no encontrado", 404);
        }
        const tokenAutorizacion = usuarioDb.tokenAutorizado || ''; */

        const respuestaHistorial = await axios.get(
          `${urlMantenimientos}/mantenimiento/listar-historial?tipoId=${tipoId}&vigiladoId=${nitVigilado}&placa=${placa}`,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'Content-Type': 'application/json'
            }
          }
        );

        return respuestaHistorial.data;
      } catch (errorExterno: any) {
        console.error("Error al consultar historial desde API externo:", errorExterno);
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al consultar historial de mantenimiento",
          errorExterno.response?.status || 500
        );
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de historial para este usuario"
      );
    }
  }

  // MÉTODO ANTERIOR COMENTADO - se mantiene por si se necesita volver a lógica local
  /* async listarHistorialLocal(
    tipoId: number,
    vigiladoId: string,
    placa: string
  ): Promise<any[]> {
    try {
      const usuario = await TblUsuarios.query()
        .where("identificacion", vigiladoId)
        .first();

      let mantenimientosArr = new Array();

      const mantenimientos = await TblMantenimiento.query().orderBy('id', 'desc')
        .where("placa", placa)
        .where("usuarioId", usuario?.id!)
        .where("tipoId", tipoId);

      if (tipoId == 1 && mantenimientos.length > 0) {
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblPreventivo.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 2 && mantenimientos.length > 0) {
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblCorrectivo.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 3 && mantenimientos.length > 0) {
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblAlistamiento.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 4 && mantenimientos.length > 0) {
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblAutorizaciones.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();

          if (mantenimientosDB) {
            const estado = mantenimientosDB.fechaViaje
              ? (() => {
                const today = this.getColombiaDateTime().startOf('day');

                const viajeDate = DateTime.fromJSDate(new Date(mantenimientosDB.fechaViaje)).startOf('day');

                const timeDifference = today.diff(viajeDate, 'days').days;
                return timeDifference <= 0;
              })()
              : true;
            if (estado !== mantenimientosDB.estado) {
              await TblMantenimiento.query().where("id", mantenimiento.id!).update({ estado })
            }
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: estado });
          }
        }
      }


      return mantenimientosArr;
    } catch (error) {
      console.log(error);

      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  } */

  async listarActividades(): Promise<any[]> {
    try {
      const actividades = await TblActividadesAlistamiento.query().where('estado', true).orderBy('nombre', 'asc');
      return actividades.map((actividad) => {
        return {
          id: actividad.id,
          nombre: actividad.nombre,
          estado: false,
        };
      });
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  async listarTiposIdentificacion(): Promise<any[]> {
    try {
      const tipos = await this.obtenerParametrica('listar-tipo-identificaciones');
      if (!Array.isArray(tipos)) {
        return [];
      }
      return tipos.map((tipo: any) => ({
        codigo: tipo.codigo,
        descripcion: tipo.descripcion,
      }));
    } catch (error: any) {
      console.log(error);
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudieron obtener los tipos de identificación");
    }
  }

  private async mapearTrabajosConDetalle(
    trabajos: TblMantenimientoJob[],
    estadoObjetivo?: string
  ): Promise<any[]> {
    if (trabajos.length === 0) {
      return [];
    }

    const mantenimientoIds = new Set<number>();
    const preventivoIds = new Set<number>();
    const correctivoIds = new Set<number>();
    const alistamientoIds = new Set<number>();
    const autorizacionIds = new Set<number>();

    for (const job of trabajos) {
      if (typeof job.mantenimientoLocalId === 'number' && Number.isFinite(job.mantenimientoLocalId)) {
        mantenimientoIds.add(job.mantenimientoLocalId);
      }

      if (typeof job.detalleId === 'number' && Number.isFinite(job.detalleId)) {
        switch (job.tipo) {
          case 'preventivo':
            preventivoIds.add(job.detalleId);
            break;
          case 'correctivo':
            correctivoIds.add(job.detalleId);
            break;
          case 'alistamiento':
            alistamientoIds.add(job.detalleId);
            break;
          case 'autorizacion':
            autorizacionIds.add(job.detalleId);
            break;
          default:
            break;
        }
      }
    }

    const [
      mantenimientos,
      preventivos,
      correctivos,
      alistamientos,
      autorizaciones,
      detallesActividades
    ] = await Promise.all([
      mantenimientoIds.size > 0 ? TblMantenimiento.query().whereIn('id', Array.from(mantenimientoIds)) : Promise.resolve([]),
      preventivoIds.size > 0 ? TblPreventivo.query().whereIn('id', Array.from(preventivoIds)) : Promise.resolve([]),
      correctivoIds.size > 0 ? TblCorrectivo.query().whereIn('id', Array.from(correctivoIds)) : Promise.resolve([]),
      alistamientoIds.size > 0 ? TblAlistamiento.query().whereIn('id', Array.from(alistamientoIds)) : Promise.resolve([]),
      autorizacionIds.size > 0 ? TblAutorizaciones.query().whereIn('id', Array.from(autorizacionIds)) : Promise.resolve([]),
      alistamientoIds.size > 0 ? TblDetallesAlistamientoActividades.query().whereIn('tda_alistamiento_id', Array.from(alistamientoIds)) : Promise.resolve([]),
    ]);

    const mantenimientosPorId = new Map<number, TblMantenimiento>();
    for (const mantenimiento of mantenimientos) {
      if (typeof mantenimiento.id === 'number') {
        mantenimientosPorId.set(mantenimiento.id, mantenimiento);
      }
    }

    const preventivosPorId = new Map<number, TblPreventivo>();
    for (const preventivo of preventivos) {
      if (typeof preventivo.id === 'number') {
        preventivosPorId.set(preventivo.id, preventivo);
      }
    }

    const correctivosPorId = new Map<number, TblCorrectivo>();
    for (const correctivo of correctivos) {
      if (typeof correctivo.id === 'number') {
        correctivosPorId.set(correctivo.id, correctivo);
      }
    }

    const alistamientosPorId = new Map<number, TblAlistamiento>();
    for (const alistamiento of alistamientos) {
      if (typeof alistamiento.id === 'number') {
        alistamientosPorId.set(alistamiento.id, alistamiento);
      }
    }

    const autorizacionesPorId = new Map<number, TblAutorizaciones>();
    for (const autorizacion of autorizaciones) {
      if (typeof autorizacion.id === 'number') {
        autorizacionesPorId.set(autorizacion.id, autorizacion);
      }
    }

    const actividadesPorAlistamiento = new Map<number, Array<{ id: number; estado: boolean }>>();
    for (const detalle of detallesActividades) {
      if (typeof detalle.alistamientoId === 'number') {
        const lista = actividadesPorAlistamiento.get(detalle.alistamientoId) ?? [];
        lista.push({ id: detalle.actividadId, estado: detalle.estado });
        actividadesPorAlistamiento.set(detalle.alistamientoId, lista);
      }
    }

    const jobsParaActualizar: TblMantenimientoJob[] = [];
    const respuesta: any[] = [];

    for (const job of trabajos) {
      const mantenimientoModelo = job.mantenimientoLocalId ? mantenimientosPorId.get(job.mantenimientoLocalId) : undefined;
      const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};

      let detalleModelo: TblPreventivo | TblCorrectivo | TblAlistamiento | TblAutorizaciones | undefined;
      switch (job.tipo) {
        case 'preventivo':
          detalleModelo = job.detalleId ? preventivosPorId.get(job.detalleId) : undefined;
          break;
        case 'correctivo':
          detalleModelo = job.detalleId ? correctivosPorId.get(job.detalleId) : undefined;
          break;
        case 'alistamiento':
          detalleModelo = job.detalleId ? alistamientosPorId.get(job.detalleId) : undefined;
          break;
        case 'autorizacion':
          detalleModelo = job.detalleId ? autorizacionesPorId.get(job.detalleId) : undefined;
          break;
        default:
          detalleModelo = undefined;
          break;
      }

      const procesado = this.jobEstaProcesado(job, mantenimientoModelo, detalleModelo ?? null);

      if (procesado && job.estado === 'fallido') {
        job.merge({ estado: 'procesado', ultimoError: null, siguienteIntento: this.getColombiaDateTime() });
        jobsParaActualizar.push(job);
        if (estadoObjetivo === 'fallido') {
          continue;
        }
      }

      const mantenimientoJson = this.construirMantenimientoRespuesta(job, mantenimientoModelo ?? null);
      let detalleJson = this.construirDetalleRespuesta(job, mantenimientoModelo ?? null, detalleModelo ?? null, payload);

      const esAlistamiento = job.tipo === 'alistamiento' || (job.tipo === 'base' && (mantenimientoModelo?.tipoId ?? payload.tipoId) === 3);

      if (esAlistamiento) {
        const alistamientoId = job.tipo === 'alistamiento'
          ? detalleModelo?.id ?? null
          : job.detalleId ?? (mantenimientoModelo?.id ?? null);
        const actividadesRegistradas = alistamientoId ? actividadesPorAlistamiento.get(alistamientoId) : undefined;
        const actividades = actividadesRegistradas && actividadesRegistradas.length > 0
          ? actividadesRegistradas
          : this.normalizarActividades(job.payload?.actividades ?? []);

        if (detalleJson) {
          detalleJson.actividades = actividades;
        } else if (actividades.length > 0) {
          detalleJson = { actividades };
        }
      }

      const datosCompletos = this.construirDatosCompletos(job, mantenimientoModelo ?? null, detalleJson);

      respuesta.push({
        id: job.id,
        tipo: job.tipo,
        estado: job.estado,
        reintentos: job.reintentos,
        ultimoError: job.ultimoError,
        siguienteIntento: job.siguienteIntento ? job.siguienteIntento.toISO() : null,
        createdAt: job.createdAt ? job.createdAt.toISO() : null,
        updatedAt: job.updatedAt ? job.updatedAt.toISO() : null,
        mantenimientoLocalId: job.mantenimientoLocalId,
        detalleId: job.detalleId,
        vigiladoId: job.vigiladoId,
        usuarioDocumento: job.usuarioDocumento,
        payload: job.payload ?? null,
        mantenimiento: mantenimientoJson,
        detalle: detalleJson,
        datosCompletos,
      });
    }

    if (jobsParaActualizar.length > 0) {
      await Promise.all(jobsParaActualizar.map((job) => job.save()));
    }

    return respuesta;
  }

  async listarTrabajosProgramados(
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
    const paginaNormalizada = pagina && pagina > 0 ? pagina : 1;
    const limiteNormalizado = limite && limite > 0 ? limite : 10;

    const { nitVigilado } = await this.obtenerDatosAutenticacion(usuario, idRol);
    const estadoFiltrado = typeof filtros?.estado === 'string' && filtros.estado.trim() !== ''
      ? filtros.estado.trim().toLowerCase()
      : null;

    const aplicarFiltros = (builder: ModelQueryBuilderContract<typeof TblMantenimientoJob>) => {
      if (filtros?.estado) {
        const estadoSolicitado = filtros.estado;
        builder.andWhere((estadoBuilder) => {
          estadoBuilder.where('tmj_estado', estadoSolicitado);

          estadoBuilder.orWhereIn('tmj_mantenimiento_local_id', (subquery) => {
            subquery
              .from(TblMantenimientoJob.table)
              .select('tmj_mantenimiento_local_id')
              .where('tmj_estado', estadoSolicitado)
              .whereNotNull('tmj_mantenimiento_local_id');
          });

          estadoBuilder.orWhereIn('tmj_detalle_id', (subquery) => {
            subquery
              .from(TblMantenimientoJob.table)
              .select('tmj_detalle_id')
              .where('tmj_estado', estadoSolicitado)
              .whereNotNull('tmj_detalle_id');
          });

          estadoBuilder.orWhereExists((subquery) => {
            subquery
              .select('rel.tmj_id')
              .from({ rel: TblMantenimientoJob.table })
              .where('rel.tmj_estado', estadoSolicitado)
              .andWhereRaw("LOWER(COALESCE(rel.tmj_payload->>'placa', '')) <> ''")
              .andWhereRaw(
                "LOWER(COALESCE(rel.tmj_payload->>'placa', '')) = LOWER(COALESCE(tbl_mantenimiento_jobs.tmj_payload->>'placa', ''))"
              )
              .andWhereRaw("COALESCE(rel.tmj_vigilado_id, '') = COALESCE(tbl_mantenimiento_jobs.tmj_vigilado_id, '')");
          });
        });
      }

      if (filtros?.tipo) {
        builder.andWhere('tmj_tipo', filtros.tipo);
      }

      if (filtros?.placa) {
        const placaTexto = String(filtros.placa).trim();
        if (placaTexto.length > 0) {
          const placaNormalizada = placaTexto.toLowerCase();
          builder.andWhereRaw("LOWER(COALESCE(tmj_payload->>'placa', '')) = ?", [placaNormalizada]);
        }
      }

      if (nitVigilado) {
        builder.andWhere('tmj_vigilado_id', nitVigilado);
      }

      if (filtros?.fecha) {
        const fechaFiltro = DateTime.fromISO(String(filtros.fecha));
        if (fechaFiltro.isValid) {
          const fechaISO = fechaFiltro.toISODate();
          builder.andWhereRaw('DATE(tmj_creado) = ?', [fechaISO]);
        }
      }

      if (typeof filtros?.sincronizacionEstado === 'string') {
        switch (filtros.sincronizacionEstado) {
          case 'pendiente':
            builder.andWhereNull('tmj_fecha_sincronizacion');
            break;
          case 'sincronizado':
            builder.andWhereNotNull('tmj_fecha_sincronizacion');
            break;
          case 'error':
            builder.andWhereNotNull('tmj_ultimo_error');
            break;
          default:
            break;
        }
      }
    };

    const aplicarOrden = (builder: ModelQueryBuilderContract<typeof TblMantenimientoJob>) => {
      const camposPermitidos = new Set([
        'tmj_creado',
        'tmj_actualizado',
        'tmj_siguiente_intento',
        'tmj_tipo',
        'tmj_estado',
        'tmj_reintentos',
      ]);

      if (orden?.campo && camposPermitidos.has(orden.campo)) {
        const direccion = orden.direccion ?? 'desc';
        builder.orderBy(orden.campo, direccion);
        if (orden.campo !== 'tmj_creado') {
          builder.orderBy('tmj_creado', 'desc');
        }
      } else {
        builder.orderBy('tmj_creado', 'desc');
      }
    };

    const baseQuery = TblMantenimientoJob.query();
    await this.restringirTrabajosPorUsuario(baseQuery, nitVigilado, idRol);
    aplicarFiltros(baseQuery);

    const clavesOrden: string[] = [];
    const registrosPorClave = new Map<string, any>();

    const coincideConEstado = (registro: any, estadoObjetivo: string | null): boolean => {
      if (!estadoObjetivo) {
        return true;
      }

      const comparar = (valor: unknown) => {
        return typeof valor === 'string' && valor.trim().toLowerCase() === estadoObjetivo;
      };

      if (comparar(registro?.estado)) {
        return true;
      }

      if (Array.isArray(registro?.trabajosAsociados)) {
        for (const asociado of registro.trabajosAsociados) {
          if (comparar(asociado?.estado)) {
            return true;
          }
        }
      }

      if (comparar(registro?.cabecera?.estado)) {
        return true;
      }

      return false;
    };

    const preferir = (actual: any, candidato: any) => {
      if (estadoFiltrado) {
        const actualCoincide = coincideConEstado(actual, estadoFiltrado);
        const candidatoCoincide = coincideConEstado(candidato, estadoFiltrado);

        if (candidatoCoincide && !actualCoincide) {
          return candidato;
        }

        if (actualCoincide && !candidatoCoincide) {
          return actual;
        }
      }

      const actualDetalle = actual?.detalle ? 1 : 0;
      const candidatoDetalle = candidato?.detalle ? 1 : 0;
      if (candidatoDetalle > actualDetalle) {
        return candidato;
      }
      if (candidatoDetalle < actualDetalle) {
        return actual;
      }

      const marcaActual = actual?.updatedAt ?? actual?.createdAt ?? null;
      const marcaCandidato = candidato?.updatedAt ?? candidato?.createdAt ?? null;
      if (marcaActual && marcaCandidato) {
        return String(marcaCandidato) > String(marcaActual) ? candidato : actual;
      }

      return candidatoDetalle >= actualDetalle ? candidato : actual;
    };

    const chunkSize = Math.max(limiteNormalizado * 4, limiteNormalizado);
    let paginaFuente = 1;
    let hayMas = true;

    while (hayMas) {
      const chunkQuery = baseQuery.clone() as ModelQueryBuilderContract<typeof TblMantenimientoJob>;
      aplicarOrden(chunkQuery);
      chunkQuery.forPage(paginaFuente, chunkSize);
      const chunkTrabajos = await chunkQuery;

      if (chunkTrabajos.length === 0) {
        hayMas = false;
        break;
      }

      const trabajosMapeados = await this.mapearTrabajosConDetalle(chunkTrabajos);
      const trabajosUnificados = await this.vincularCabeceras(trabajosMapeados);

      for (const trabajo of trabajosUnificados) {
        const clave = this.obtenerClaveAgrupacionTrabajo(trabajo);
        if (!clave) {
          continue;
        }

        const existente = registrosPorClave.get(clave);
        if (!existente) {
          registrosPorClave.set(clave, trabajo);
          clavesOrden.push(clave);
          continue;
        }

        registrosPorClave.set(clave, preferir(existente, trabajo));
      }

      paginaFuente += 1;
      if (chunkTrabajos.length < chunkSize) {
        hayMas = false;
      }
    }

    const clavesElegibles = estadoFiltrado
      ? clavesOrden.filter((clave) => {
          const registro = registrosPorClave.get(clave);
          return coincideConEstado(registro, estadoFiltrado);
        })
      : [...clavesOrden];

    const totalRegistros = clavesElegibles.length;
    const totalPaginas = limiteNormalizado > 0 && totalRegistros > 0
      ? Math.ceil(totalRegistros / limiteNormalizado)
      : 0;

    const inicio = (paginaNormalizada - 1) * limiteNormalizado;
    const fin = inicio + limiteNormalizado;

    const datos = clavesElegibles
      .slice(inicio, fin)
      .map((clave) => registrosPorClave.get(clave))
      .filter((item): item is TrabajoProgramado => Boolean(item))
      .map((trabajo) => {
        if (estadoFiltrado && coincideConEstado(trabajo, estadoFiltrado)) {
          return {
            ...trabajo,
            estado: estadoFiltrado,
          };
        }
        return trabajo;
      });

    const paginacion = new Paginador(totalRegistros, paginaNormalizada, totalPaginas);

    return {
      paginacion,
      datos,
    };
  }

  async listarTrabajosFallidos(
    usuario: string,
    idRol: number,
    filtros?: { tipo?: string; estado?: string; nit?: string }
  ): Promise<any[]> {
    const estadoObjetivo = 'fallido';
    const query = TblMantenimientoJob.query()
      .where('tmj_estado', estadoObjetivo)
      .orderBy('tmj_actualizado', 'desc');

    await this.restringirTrabajosPorUsuario(query, usuario, idRol);

    if (filtros?.tipo) {
      query.andWhere('tmj_tipo', filtros.tipo);
    }

    if (filtros?.nit) {
      query.andWhere('tmj_vigilado_id', filtros.nit);
    }

    const trabajos = await query;
    const trabajosMapeados = await this.mapearTrabajosConDetalle(trabajos, estadoObjetivo);

    return this.vincularCabeceras(trabajosMapeados);
  }

  async obtenerTrabajoProgramado(jobId: number, usuario: string, idRol: number): Promise<any> {
    const job = await TblMantenimientoJob.find(jobId);

    if (!job) {
      throw new Exception('Trabajo no encontrado', 404);
    }

    await this.asegurarPermisoSobreJob(job, usuario, idRol);
    const resultados = await this.mapearTrabajosConDetalle([job]);
    const unificados = await this.vincularCabeceras(resultados);

    if (unificados.length === 0) {
      throw new Exception('No fue posible obtener el detalle del trabajo', 404);
    }

    return unificados[0];
  }


  private normalizarPayloadDetallePorTipo(
    jobTipo: string | null | undefined,
    payload: Record<string, any> | null | undefined
  ): Record<string, any> | null | undefined {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const resultado = { ...payload };

    if ((jobTipo === 'preventivo' || jobTipo === 'correctivo') && typeof resultado.nombreIngeniero === 'string') {
      const nombre = resultado.nombreIngeniero.trim();
      if (nombre) {
        const existente = typeof resultado.nombresResponsable === 'string' ? resultado.nombresResponsable.trim() : '';
        if (!existente) {
          resultado.nombresResponsable = nombre;
        }
      }
    }

    return resultado;
  }



  async reintentarTrabajoFallido(
    jobId: number,
    usuario: string,
    idRol: number,
    opciones?: {
      payload?: Record<string, any> | null,
      accion?: 'reprogramar' | 'actualizar' | 'marcarProcesado'
    }
  ): Promise<any> {
    const job = await TblMantenimientoJob.find(jobId);

    if (!job) {
      throw new Exception('Trabajo no encontrado', 404);
    }

    let jobCabecera: TblMantenimientoJob | null = null;
    if (job.tipo !== 'base' && typeof job.mantenimientoLocalId === 'number' && Number.isFinite(job.mantenimientoLocalId)) {
      jobCabecera = await TblMantenimientoJob.query()
        .where('tmj_mantenimiento_local_id', job.mantenimientoLocalId)
        .where('tmj_tipo', 'base')
        .orderBy('tmj_id', 'desc')
        .first();
    }

    const jobObjetivo = jobCabecera && jobCabecera.estado === 'fallido' ? jobCabecera : job;

  /*   await this.asegurarPermisoSobreJob(jobObjetivo, usuario, idRol);
    if (jobObjetivo.id !== job.id) {
      await this.asegurarPermisoSobreJob(job, usuario, idRol);
    } */

    const estadoJob = job.estado ?? null;
    const estadoObjetivo = jobObjetivo.estado ?? null;
    if (estadoJob !== 'fallido' && estadoObjetivo !== 'fallido') {
      return
     // throw new Exception('Solo se pueden reprogramar trabajos en estado fallido', 400);
    }

    const accion = opciones?.accion ?? 'reprogramar';
    const tienePayload = opciones ? Object.prototype.hasOwnProperty.call(opciones, 'payload') : false;

    let payloadParaJob: Record<string, any> | null | undefined = undefined;
    let payloadCabecera: Record<string, any> | null | undefined = undefined;

    if (tienePayload) {
      const bruto = opciones?.payload ?? null;

      if (bruto !== null && typeof bruto !== 'object') {
        throw new Exception('El payload debe ser un objeto o nulo', 400);
      }

      if (bruto && (Object.prototype.hasOwnProperty.call(bruto, 'cabecera') || Object.prototype.hasOwnProperty.call(bruto, 'detalle') || Object.prototype.hasOwnProperty.call(bruto, 'cuerpo'))) {
        const cabeceraBruta = (bruto as any).cabecera;
        const detalleBruto = (bruto as any).detalle ?? (bruto as any).cuerpo ?? null;

        if (cabeceraBruta !== undefined) {
          if (cabeceraBruta !== null && typeof cabeceraBruta !== 'object') {
            throw new Exception('El payload de la cabecera debe ser un objeto o nulo', 400);
          }
          payloadCabecera = cabeceraBruta ?? null;
        }

        if (detalleBruto !== undefined) {
          if (detalleBruto !== null && typeof detalleBruto !== 'object') {
            throw new Exception('El payload del detalle debe ser un objeto o nulo', 400);
          }
          payloadParaJob = detalleBruto ?? null;
        }

        const restante = { ...(bruto as Record<string, any>) };
        delete restante.cabecera;
        delete restante.detalle;
        delete restante.cuerpo;

        if (Object.keys(restante).length > 0) {
          if (payloadCabecera === undefined) {
            payloadCabecera = restante;
          }
          if (payloadParaJob === undefined) {
            payloadParaJob = restante;
          }
        }
      } else {
        if (jobObjetivo.tipo === 'base') {
          payloadCabecera = bruto;
          payloadParaJob = bruto;
        } else {
          payloadParaJob = bruto;
        }
      }
    }

    if (jobObjetivo.tipo === 'base' && payloadCabecera === undefined && payloadParaJob !== undefined) {
      // Garantiza que un payload único mantenga sincronizados cabecera y detalle
      payloadCabecera = payloadParaJob;
    }

    const jobCabeceraActualizar = jobObjetivo.tipo === 'base' ? jobObjetivo : jobCabecera;
    const jobDetalleActualizar = jobObjetivo.tipo === 'base' ? (job.tipo !== 'base' ? job : null) : jobObjetivo;

    if (jobCabeceraActualizar && payloadCabecera !== undefined) {
      const payloadNormalizadoCabecera = this.normalizarPayloadDetallePorTipo(jobCabeceraActualizar.tipo, payloadCabecera);
      jobCabeceraActualizar.payload = payloadNormalizadoCabecera ?? null;
      await this.actualizarDatosLocales(jobCabeceraActualizar, payloadNormalizadoCabecera ?? undefined);
      await jobCabeceraActualizar.save();
    }

    if (jobDetalleActualizar && payloadParaJob !== undefined) {
      const payloadNormalizadoDetalle = this.normalizarPayloadDetallePorTipo(jobDetalleActualizar.tipo, payloadParaJob);
      jobDetalleActualizar.payload = payloadNormalizadoDetalle ?? null;
      await this.actualizarDatosLocales(jobDetalleActualizar, payloadNormalizadoDetalle ?? undefined);
      await jobDetalleActualizar.save();
    }

    switch (accion) {
      case 'marcarProcesado':
        await this.marcarJobComoProcesado(jobObjetivo);
        return {
          mensaje: 'Trabajo marcado como procesado',
          estado: jobObjetivo.estado,
          jobId: jobObjetivo.id,
        };
      case 'actualizar':
        this.prepararReprogramacion(jobObjetivo);
        await jobObjetivo.save();
        return {
          mensaje: 'Datos actualizados y trabajo reprogramado para sincronización',
          estado: jobObjetivo.estado,
          jobId: jobObjetivo.id,
          siguienteIntento: jobObjetivo.siguienteIntento ? jobObjetivo.siguienteIntento.toISO() : null,
        };
      case 'reprogramar':
      default:
        if (jobObjetivo.reintentos >= this.MAX_REINTENTOS) {
          await jobObjetivo.save();
          throw new Exception('El trabajo alcanzó el número máximo de reintentos permitidos. Procese el mantenimiento manualmente.', 409);
        }

        this.prepararReprogramacion(jobObjetivo);
        await jobObjetivo.save();

        return {
          mensaje: 'Trabajo reprogramado para sincronización',
          estado: jobObjetivo.estado,
          jobId: jobObjetivo.id,
          siguienteIntento: jobObjetivo.siguienteIntento ? jobObjetivo.siguienteIntento.toISO() : null,
        };
    }
  }

  async listarPlacasTodas(tipoId: number, vigiladoId: string): Promise<any[]> {
    const host = "";
    const endpoint = `/vehiculos/listar-vigilado?identificacion=${vigiladoId}`;
    try {
      const respuesta = await axios.get(`${host}${endpoint}`, {});

      const mantenimientos = new Array();
      if (respuesta.data.length === 0) {
        throw new Error("No se encontraron placas");
      }
      const placas = respuesta.data;
      const usuario = await TblUsuarios.query()
        .where("identificacion", vigiladoId)
        .first();

      const mantenimientosDBX = TblMantenimiento.query().whereIn("placa", placas)
        .where("usuarioId", usuario?.id!)
        .where("tipoId", tipoId)

      if (tipoId == 4) {
        mantenimientosDBX
          .distinctOn("placa")
          .orderBy("placa")
      } else {
        mantenimientosDBX.where("estado", true)
      }
      const mantenimientosDB = await mantenimientosDBX
        .orderBy('id', 'desc');


      const hoy = this.getColombiaDateTime();

      placas.forEach((placa) => {
        const existePlaca = mantenimientosDB.find((p) => p.placa == placa);
        let estadoMantenimiento = "Sin reporte";

        if (existePlaca) {
          if (existePlaca.fechaDiligenciamiento) {
            const fechaDiligenciamiento = DateTime.fromJSDate(
              new Date(existePlaca.fechaDiligenciamiento.toString())
            ).plus({ months: 2 });
            const diferenciaDias = fechaDiligenciamiento.diff(hoy, 'days').days;

            if (!existePlaca.estado) {
              estadoMantenimiento = "Vencido";
            } else {
             /*  if (existePlaca.estadoId == 2) {
                estadoMantenimiento = "Iniciado";
              } else  */if (diferenciaDias < -1) {
                estadoMantenimiento = "Vencido";
              } else if (diferenciaDias <= 15) {
                estadoMantenimiento = "Próximo a vencer";
              } else {
                estadoMantenimiento = "Reportado vigente";
              }
            }

            mantenimientos.push({
              placa,
              fechaDiligenciamiento: existePlaca.fechaDiligenciamiento,
              estadoMantenimiento,
              tipoId,
              id: existePlaca.id,
            });
          }
        } else {
          mantenimientos.push({
            placa,
            fechaDiligenciamiento: "",
            estadoMantenimiento,
            tipoId,
            id: null,
          });
        }
      });

      const mantenimientosNoInDB = await TblMantenimiento.query()
        .whereNotIn("placa", placas)
        .where("usuarioId", usuario?.id!)
        .where("tipoId", tipoId)
        .where("estado", true).orderBy('id', 'desc');

      mantenimientosNoInDB.forEach(mant => {
        const existeMant = mantenimientos.find(m => m.placa == mant.placa);
        if (!existeMant) {
          mantenimientos.push({
            placa: mant.placa,
            fechaDiligenciamiento: mant.fechaDiligenciamiento,
            estadoMantenimiento: "Placa desvinculada",
            tipoId,
            id: mant.id,
          })
        }
      });


      return mantenimientos;
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  async listarHistorialExportar(
    tipoId: number,
    vigiladoId: string,
    placa: string
  ): Promise<any[]> {
    try {
      const usuario = await TblUsuarios.query()
        .where("identificacion", vigiladoId)
        .first();

      let mantenimientosArr = new Array();

      const mantenimientos = await TblMantenimiento.query().orderBy('id', 'desc')
        .where("placa", placa)
        .where("usuarioId", usuario?.id!)
        .where("tipoId", tipoId);

      if (tipoId == 1 && mantenimientos.length > 0) {
        const parametricas = await this.obtenerParametrica('listar-tipo-identificaciones');

        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblPreventivo.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const parametrica = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacion)
            mantenimientosDB.tipoIdentificacion = parametrica.descripcion
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 2 && mantenimientos.length > 0) {
        const parametricas = await this.obtenerParametrica('listar-tipo-identificaciones');
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblCorrectivo.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const parametrica = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacion)
            mantenimientosDB.tipoIdentificacion = parametrica.descripcion
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 3 && mantenimientos.length > 0) {
        const parametricas = await this.obtenerParametrica('listar-tipo-identificaciones');
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblAlistamiento.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const parametrica1 = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionResponsable)
            mantenimientosDB.tipoIdentificacionResponsable = parametrica1.descripcion
            const parametrica2 = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionConductor)
            mantenimientosDB.tipoIdentificacionConductor = parametrica2.descripcion
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 4 && mantenimientos.length > 0) {
        const parametricas = await this.obtenerParametrica('listar-tipo-identificaciones');
        const parametricaCentros = await this.obtenerParametrica('listar-centros-poblados');
        const parametricaDiscapacidad = await this.obtenerParametrica('listar-tipo-discapacidades');
        const parametricaPoblacion = await this.obtenerParametrica('listar-tipo-poblaciones-etnicas');
        const parametricaSexo = await this.obtenerParametrica('listar-tipo-sexos');
        const parametricacalidadActua = await this.obtenerParametrica('listar-tipo-parentescos');



        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblAutorizaciones.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const tipoIdentificacionNna = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionNna)
            mantenimientosDB.tipoIdentificacionNna = tipoIdentificacionNna.descripcion
            const tipoIdentificacionOtorgante = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionOtorgante)
            mantenimientosDB.tipoIdentificacionOtorgante = tipoIdentificacionOtorgante.descripcion
            const tipoIdentificacionAutorizadoViajar = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionAutorizadoViajar)
            mantenimientosDB.tipoIdentificacionAutorizadoViajar = tipoIdentificacionAutorizadoViajar.descripcion
            const tipoIdentificacionAutorizadoRecoger = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionAutorizadoRecoger)
            mantenimientosDB.tipoIdentificacionAutorizadoRecoger = tipoIdentificacionAutorizadoRecoger.descripcion

            const origen = parametricaCentros.find((p: any) => p.codigo == mantenimientosDB.origen)
            mantenimientosDB.origen = origen?.descripcion ?? ''
            const destino = parametricaCentros.find((p: any) => p.codigo == mantenimientosDB.destino)
            mantenimientosDB.destino = destino?.descripcion ?? ''

            const tipoDiscapacidad = parametricaDiscapacidad.find((p: any) => p.codigo == mantenimientosDB.tipoDiscapacidad)
            mantenimientosDB.tipoDiscapacidad = tipoDiscapacidad?.descripcion ?? ''

            const tipoPoblacionEtnica = parametricaPoblacion.find((p: any) => p.codigo == mantenimientosDB.tipoPoblacionEtnica)
            mantenimientosDB.tipoPoblacionEtnica = tipoPoblacionEtnica?.descripcion ?? ''

            const sexoOtorgante = parametricaSexo.find((p: any) => p.codigo == mantenimientosDB.sexoOtorgante)
            mantenimientosDB.sexoOtorgante = sexoOtorgante?.descripcion ?? ''

            const calidadActua = parametricacalidadActua.find((p: any) => p.codigo == mantenimientosDB.calidadActua)
            mantenimientosDB.calidadActua = calidadActua?.descripcion ?? ''


            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }


      return mantenimientosArr;
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  private async obtenerParametrica(endpoint: string) {
    const host = Env.get('URL_PARAMETRICAS')
    const headers = {
      'Authorization': `Bearer REDACTED-TOKEN-PARAMETRICO`
    };

    try {
      const respuesta = await axios.get(`${host}/parametrica/${endpoint}`, { headers });
      return respuesta.data;
    } catch (error) {
      return []
    }
  }
}
