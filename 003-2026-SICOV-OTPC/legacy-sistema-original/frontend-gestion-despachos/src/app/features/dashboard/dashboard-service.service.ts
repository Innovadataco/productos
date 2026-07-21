import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { BaseApiService } from "src/app/core/base-api.service";
import { environment } from "src/environments/environment";
import { RetryContext } from "src/app/core/models/retry-context.models";

@Injectable({ providedIn: 'root' })
export class DashboardService {

  private readonly http = inject(HttpClient);
  private readonly api = inject(BaseApiService);
  private readonly base = environment.urlBackend + '/api/v1';
  constructor() {}

  getClientes() {
    const url = `${this.base}/usuarios-clientes`;
    return this.http.get<any>(url);
  }

  getResumenDatos(nit?: string, fechaInicio?: string, fechaFin?: string) {
    let url = `${this.base}/dashboard`;
    const params: string[] = [];
    if (nit) {
      params.push(`nit=${nit}`);
    }
    if (fechaInicio) {
      params.push(`fechaInicio=${fechaInicio}`);
    }
    if (fechaFin) {
      params.push(`fechaFin=${fechaFin}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.http.get<any>(url);
  }

  getPlacas(placa?: string, nit?: string) {
    let url = `${this.base}/dashboard/placas`;
    const params: string[] = [];
    if (placa) {
      params.push(`placa=${placa}`);
    }
    if (nit) {
      params.push(`nit=${nit}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.http.get<any>(url);
  }

  getLogs(nit?: string) {
    let url = `${this.base}/dashboard/logs`;
    const params: string[] = [];
    if (nit) {
      params.push(`nit=${nit}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.http.get<any>(url);
  }

  consultarIntegradora(datos?: Integradora) {
    let url = ``;
    const params: string[] = [];
    if (datos?.numeroIdentificacion1) {
      params.push(`numeroIdentificacion1=${datos.numeroIdentificacion1}`);
    }
    if (datos?.numeroIdentificacion2) {
      params.push(`numeroIdentificacion2=${datos.numeroIdentificacion2}`);
    }
    if (datos?.placa) {
      params.push(`placa=${datos.placa}`);
    }
    if (datos?.nit) {
      params.push(`nit=${datos.nit}`);
    }
    if (datos?.fechaConsulta) {
      params.push(`fechaConsulta=${datos.fechaConsulta}`);
    }
    if (datos?.horaConsulta) {
      params.push(`horaConsulta=${datos.horaConsulta}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.api.postIntegradora<any>(url, {});
  }

  listarProcesos(pagina?: number, limite?: number, nit?: string, terminos?: Terminos) {
    //console.log('listarProcesos llamados con terminos:', terminos);
    let url = `/api/v1/mantenimiento/jobs`;
    const params: string[] = [];
    if (pagina !== undefined) {
      params.push(`pagina=${pagina}`);
    }
    if (limite !== undefined) {
      params.push(`limite=${limite}`);
    }
    if (nit) {
      params.push(`nit=${nit}`);
    }
    if (terminos) {
      if (terminos.placa) {
        params.push(`placa=${terminos.placa}`);
      }
      if (terminos.estado) {
        if (terminos.estado !== 'undefined') {
          params.push(`estado=${terminos.estado}`);
        }
      }
      if (terminos.fecha) {
        params.push(`fecha=${terminos.fecha}`);
      }
      if (terminos.tipo) {
        if (terminos.tipo !== 'undefined') {
          params.push(`tipo=${terminos.tipo}`);
        }
      }
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.api.get<any>(url);
  }

  listarFallidos(nit?: string) {
    let url = `/api/v1/mantenimiento/jobs-fallidos`;
    const params: string[] = [];
    if (nit) {
      params.push(`nit=${nit}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.api.get<any>(url);
  }

  // Reintentos manuales reutilizan el mismo endpoint que el automático, enviando body con accion/payload
  reintentarPreventivo(ctx: RetryContext, payload: any) {
    return this.reintento(ctx.jobId ?? ctx.mantenimientoLocalId ?? 0, { accion: 'actualizar', payload });
  }

  reintentarCorrectivo(ctx: RetryContext, payload: any) {
    return this.reintento(ctx.jobId ?? ctx.mantenimientoLocalId ?? 0, { accion: 'actualizar', payload });
  }

  reintentarAlistamiento(ctx: RetryContext, payload: any) {
    return this.reintento(ctx.jobId ?? ctx.mantenimientoLocalId ?? 0, { accion: 'actualizar', payload });
  }

  reintentarBase(ctx: RetryContext, payload: any) {
    return this.reintento(ctx.jobId ?? ctx.mantenimientoLocalId ?? 0, { accion: 'actualizar', payload });
  }

  reintento(idJobFallido: number, body?: any) {
    const url = `/api/v1/mantenimiento/jobs-fallidos/${idJobFallido}/reintentar`;
    return this.api.post<any>(url, body || {});
  }
}

export interface Integradora {
  numeroIdentificacion1?: string;
  numeroIdentificacion2?: string;
  placa?: string;
  nit?: string;
  fechaConsulta?: string;
  horaConsulta?: string;
}

export interface Conductor {
  persona: {
    tipoDocumento: number;
    numeroIdentificacion: string;
    nombres: string;
    apellidos: string;
    primerNombre?: string;
    segundoNombre?: string | null;
    primerApellido?: string;
    segundoApellido?: string | null;
    mensaje?: string | null;
  };
  licencia: {
    numeroLicencia: string;
    estado: string;
    fechaVencimiento: string;
  };
  alcoholimetria: {
    resultado: string;
    grado: string;
    fecha: string;
    hora: string;
    codigo: number;
  };
  aptitudFisica: {
    resultado: string | null;
    grado: string | null;
    fecha: string | null;
    hora: string | null;
    codigo: number | null;
    mensaje?: string | null;
  };
}

export interface Vehiculo {
  placa: string;
  claseVehiculoCodigo: number;
  claseVehiculo: string;
  numeroSoat: string;
  soatVencimiento: string;
  numeroRtm: number;
  rtmVencimiento: string;
}

export interface Terminos {
  placa?: string;
  estado?: string;
  fecha?: string;
  tipo?: string;
}
