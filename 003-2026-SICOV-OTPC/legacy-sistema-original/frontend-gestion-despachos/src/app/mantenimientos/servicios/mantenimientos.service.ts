import { Injectable, inject } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { BaseApiService } from '../../core/base-api.service';
import { MantenimientoPreventivo } from '../modelos/RegistroMantenimiento';
import { ProtocoloAlistamiento } from '../modelos/RegistroProtocoloAlistamiento';
import { Autorizacion } from '../modelos/RegistroAutorizacion';
import Swal from 'sweetalert2';
import saveAs from 'file-saver';

@Injectable({ providedIn: 'root' })
export class ServiciosMantenimientos {
  private readonly api = inject(BaseApiService);

  descripcionPlantillaMasivo(tipo: string) {
    if (tipo === 'correctivo' || tipo === 'preventivo') {
      Swal.fire({
        title: 'Información de la plantilla de carga masiva',
        html: `
              <p>La plantilla de carga masiva debe seguir el siguiente formato:</p>
              <ul class="text-start">
                <li>Formato de archivo: XLSX (Excel).</li>
                <li>Columnas obligatorias para mantenimiento preventivo/correctivo:</li>
                <ul class="text-start">
                  <li><strong>vigiladoId:</strong> NIT de la empresa de transporte.</li>
                  <li><strong>placa:</strong> Placa del vehículo al que se le realiza el mantenimiento.</li>
                  <li><strong>fecha:</strong> Fecha del mantenimiento (formato AAAA-MM-DD).</li>
                  <li><strong>hora:</strong> Hora del mantenimiento (formato HH:mm).</li>
                  <li><strong>nit:</strong> NIT de la empresa que realiza el mantenimiento.</li>
                  <li><strong>razonSocial:</strong> Razón social de la empresa que realiza el mantenimiento.</li>
                  <li><strong>tipoIdentificacion:</strong> Tipo de identificación.</li>
                  <li><strong>numeroIdentificacion:</strong> Número de identificación.</li>
                  <li><strong>nombresResponsable:</strong> Nombre del responsable del mantenimiento.</li>
                  <li><strong>detalleActividades:</strong> Descripción detallada del mantenimiento realizado.</li>
                </ul>
              </ul>
              <p>Asegúrese de que los datos estén correctamente formateados para evitar errores durante el proceso de carga.</p>
            `,
        icon: 'info',
        width: '60rem',
        confirmButtonText: 'Cerrar',
      });
    } else {
      Swal.fire({
        title: 'Información de la plantilla de carga masiva',
        html: `
              <p>La plantilla de carga masiva debe seguir el siguiente formato:</p>
              <ul class="text-start">
                <li>Formato de archivo: XLSX (Excel).</li>
                <li>Columnas obligatorias para alistamiento:</li>
                <ul class="text-start">
                  <li><strong>vigiladoId:</strong> NIT de la empresa de transporte.</li>
                  <li><strong>placa:</strong> Placa del vehículo al que se le realiza el alistamiento.</li>
                  <li><strong>tipoIdentificacionResponsable:</strong> Tipo de identificación del responsable.</li>
                  <li><strong>numeroIdentificacionResponsable:</strong> Número de identificación del responsable.</li>
                  <li><strong>nombreResponsable:</strong> Nombre del responsable del alistamiento.</li>
                  <li><strong>tipoIdentificacionConductor:</strong> Tipo de identificación del conductor.</li>
                  <li><strong>numeroIdentificacionConductor:</strong> Número de identificación del conductor.</li>
                  <li><strong>nombresConductor:</strong> Nombre del conductor.</li>
                  <li><strong>detalleActividades:</strong> Descripción detallada del alistamiento realizado.</li>
                  <li><strong>actividades:</strong> Lista de actividades realizadas (1, 2, 3). Revise la hoja de actividades.</li>
                </ul>
              </ul>
              <p>Asegúrese de que los datos estén correctamente formateados para evitar errores durante el proceso de carga.</p>
            `,
        icon: 'info',
        width: '60rem',
        confirmButtonText: 'Cerrar',
      });
    }
  }

  guardarArchivo(
    tipo: any,
    documento: string,
    nombreOriginal: string,
    ruta: string,
    vigiladoId: any
  ): Observable<unknown> {
    const endpoint = '/api/v1/archivos_programas';
    const formData = new FormData();
    formData.append('tipoId', tipo);
    formData.append('documento', documento);
    formData.append('nombreOriginal', nombreOriginal);
    formData.append('ruta', ruta);
    formData.append('vigiladoId', vigiladoId);
    return this.api.post<unknown>(endpoint, formData, true);
  }

  listarDocumentos(tipoId: any, vigiladoId: any) {
    const endpoint = `/api/v1/archivos_programas?tipoId=${tipoId}&vigiladoId=${vigiladoId}`;
    return this.api.get(endpoint);
  }

  listarRegistros(tipoId: any, vigiladoId: any, rolId?: any) {
    let endpoint = '';
    if (rolId == 9) {
      endpoint = `/api/v1/mantenimiento/listar-placas-todas?tipoId=${tipoId}&vigiladoId=${vigiladoId}`;
    } else {
      endpoint = `/api/v1/mantenimiento/listar-placas?tipoId=${tipoId}&vigiladoId=${vigiladoId}`;
    }
    return this.api.get(endpoint);
  }

  listarRegistrosTodos(tipoId: any, vigiladoId: any) {
    const endpoint = `/api/v1/mantenimiento/listar-placas-todas?tipoId=${tipoId}&vigiladoId=${vigiladoId}`;
    return this.api.get(endpoint);
  }

  guardarMantenimiento(vigiladoId: any, placa: any, tipoId: any) {
    const endpoint = `/api/v1/mantenimiento/guardar-mantenimieto`;
    const formData = new FormData();
    formData.append('tipoId', tipoId);
    formData.append('vigiladoId', vigiladoId);
    formData.append('placa', placa);
    return this.api.post(endpoint, formData, true);
  }

  guardarMantenimientoPreventivo(mantenimiento: MantenimientoPreventivo, id: any) {
    const endpoint = `/api/v1/mantenimiento/guardar-preventivo`;
    const formData = new FormData();
    formData.append('mantenimientoId', id);
    formData.append('placa', mantenimiento.placa!);
    formData.append('fecha', mantenimiento.fecha!);
    formData.append('hora', mantenimiento.hora!);
    formData.append('nit', mantenimiento.nit!.toString());
    formData.append('razonSocial', mantenimiento.razonSocial!);
    formData.append('tipoIdentificacion', mantenimiento.tipoIdentificacion!);
    formData.append('numeroIdentificacion', mantenimiento.numeroIdentificacion!.toString());
    formData.append('nombresResponsable', mantenimiento.nombreIngeniero!);
    formData.append('detalleActividades', mantenimiento.detalleActividades!);
    return this.api.post(endpoint, formData, true);
  }

  guardarMantenimientoCorrectivo(mantenimiento: MantenimientoPreventivo, id: any) {
    const endpoint = `/api/v1/mantenimiento/guardar-correctivo`;
    const formData = new FormData();
    formData.append('mantenimientoId', id);
    formData.append('placa', mantenimiento.placa!);
    formData.append('fecha', mantenimiento.fecha!);
    formData.append('hora', mantenimiento.hora!);
    formData.append('nit', mantenimiento.nit!.toString());
    formData.append('razonSocial', mantenimiento.razonSocial!);
    formData.append('tipoIdentificacion', mantenimiento.tipoIdentificacion!);
    formData.append('numeroIdentificacion', mantenimiento.numeroIdentificacion!.toString());
    formData.append('nombresResponsable', mantenimiento.nombreIngeniero!);
    formData.append('detalleActividades', mantenimiento.detalleActividades!);
    return this.api.post(endpoint, formData, true);
  }

  guardarAlistamiento(protocoloAlistamiento: ProtocoloAlistamiento, id: any) {
    const endpoint = `/api/v1/mantenimiento/guardar-alistamiento`;
    const body = {
      mantenimientoId: id,
      placa: protocoloAlistamiento.placa,
      tipoIdentificacionResponsable: protocoloAlistamiento.tipoIdentificacion,
      numeroIdentificacionResponsable: protocoloAlistamiento.numeroIdentificacion,
      nombreResponsable: protocoloAlistamiento.nombreResponsable,
      tipoIdentificacionConductor: protocoloAlistamiento.tipoIdentificacionConductor,
      numeroIdentificacionConductor: protocoloAlistamiento.numeroIdentificacionConductor,
      nombresConductor: protocoloAlistamiento.nombreConductor,
      actividades: protocoloAlistamiento.actividades,
      detalleActividades: protocoloAlistamiento.detalleActividades,
    };
    return this.api.post(endpoint, body);
  }

  guardarAutorizacion(autorizacion: Autorizacion, id: any) {
    const endpoint = `/api/v1/mantenimiento/guardar-autorizacion`;
    const body = {
      mantenimientoId: id,
      fechaViaje: autorizacion.fechaViaje,
      origen: autorizacion.origen,
      destino: autorizacion.destino,
      tipoIdentificacionNna: autorizacion.tipoIdentificacionNna,
      numeroIdentificacionNna: autorizacion.numeroIdentificacionNna,
      nombresApellidosNna: autorizacion.nombresApellidosNna,
      situacionDiscapacidad: autorizacion.situacionDiscapacidad,
      tipoDiscapacidad: autorizacion.tipoDiscapacidad,
      perteneceComunidadEtnica: autorizacion.perteneceComunidadEtnica,
      tipoPoblacionEtnica: autorizacion.tipoPoblacionEtnica,
      tipoIdentificacionOtorgante: autorizacion.tipoIdentificacionOtorgante,
      numeroIdentificacionOtorgante: autorizacion.numeroIdentificacionOtorgante,
      nombresApellidosOtorgante: autorizacion.nombresApellidosOtorgante,
      numeroTelefonicoOtorgante: autorizacion.numeroTelefonicoOtorgante,
      correoElectronicoOtorgante: autorizacion.correoElectronicoOtorgante,
      direccionFisicaOtorgante: autorizacion.direccionFisicaOtorgante,
      sexoOtorgante: autorizacion.sexoOtorgante,
      generoOtorgante: autorizacion.generoOtorgante,
      calidadActua: autorizacion.calidadActua,
      tipoIdentificacionAutorizadoViajar: autorizacion.tipoIdentificacionAutorizadoViajar,
      numeroIdentificacionAutorizadoViajar: autorizacion.numeroIdentificacionAutorizadoViajar,
      nombresApellidosAutorizadoViajar: autorizacion.nombresApellidosAutorizadoViajar,
      numeroTelefonicoAutorizadoViajar: autorizacion.numeroTelefonicoAutorizadoViajar,
      direccionFisicaAutorizadoViajar: autorizacion.direccionFisicaAutorizadoViajar,
      tipoIdentificacionAutorizadoRecoger: autorizacion.tipoIdentificacionAutorizadoRecoger,
      numeroIdentificacionAutorizadoRecoger: autorizacion.numeroIdentificacionAutorizadoRecoger,
      nombresApellidosAutorizadoRecoger: autorizacion.nombresApellidosAutorizadoRecoger,
      numeroTelefonicoAutorizadoRecoger: autorizacion.numeroTelefonicoAutorizadoRecoger,
      direccionFisicaAutorizadoRecoger: autorizacion.direccionFisicaAutorizadoRecoger,
      copiaAutorizacionViajeNombreOriginal: autorizacion.copiaAutorizacionViajeNombreOriginal,
      copiaAutorizacionViajeDocumento: autorizacion.copiaAutorizacionViajeDocumento,
      copiaAutorizacionViajeRuta: autorizacion.copiaAutorizacionViajeRuta,
      copiaDocumentoParentescoNombreOriginal: autorizacion.copiaDocumentoParentescoNombreOriginal,
      copiaDocumentoParentescoDocumento: autorizacion.copiaDocumentoParentescoDocumento,
      copiaDocumentoParentescoRuta: autorizacion.copiaDocumentoParentescoRuta,
      copiaDocumentoIdentidadAutorizadoNombreOriginal:
        autorizacion.copiaDocumentoIdentidadAutorizadoNombreOriginal,
      copiaDocumentoIdentidadAutorizadoDocumento:
        autorizacion.copiaDocumentoIdentidadAutorizadoDocumento,
      copiaDocumentoIdentidadAutorizadoRuta: autorizacion.copiaDocumentoIdentidadAutorizadoRuta,
      copiaConstanciaEntregaNombreOriginal: autorizacion.copiaConstanciaEntregaNombreOriginal,
      copiaConstanciaEntregaDocumento: autorizacion.copiaConstanciaEntregaDocumento,
      copiaConstanciaEntregaRuta: autorizacion.copiaConstanciaEntregaRuta,
    };
    return this.api.post(endpoint, body);
  }

  visualizarMantenimientoPreventivo(id: any) {
    const endpoint = `/api/v1/mantenimiento/visualizar-preventivo?mantenimientoId=${id}`;
    return this.api.get(endpoint);
  }

  visualizarMantenimientoCorrectivo(id: any) {
    const endpoint = `/api/v1/mantenimiento/visualizar-correctivo?mantenimientoId=${id}`;
    return this.api.get(endpoint);
  }

  visualizarAlistamiento(id: any) {
    const endpoint = `/api/v1/mantenimiento/visualizar-alistamiento?mantenimientoId=${id}`;
    return this.api.get(endpoint);
  }

  visualizarAutorizacion(id: any) {
    const endpoint = `/api/v1/mantenimiento/visualizar-autorizacion?mantenimientoId=${id}`;
    return this.api.get(endpoint);
  }

  historial(tipoId: any, vigiladoId: any, placa: string) {
    const endpoint = `/api/v1/mantenimiento/listar-historial?tipoId=${tipoId}&vigiladoId=${vigiladoId}&placa=${placa}`;
    return this.api.get(endpoint);
  }

  listarActividades() {
    const endpoint = `/api/v1/mantenimiento/listar-actividades`;
    return this.api.get(endpoint);
  }

  exportarHistorial(tipoId: any, vigiladoId: any, placa: string) {
    const endpoint = `/api/v1/mantenimiento/exportar-historial?tipoId=${tipoId}&vigiladoId=${vigiladoId}&placa=${placa}`;
    const url = `${location.origin}${endpoint}`;
    return url;
  }

  descargarPlantillaMasivo(url: string, nombreArchivo: string) {
    return this.api
      .download(url)
      .pipe(
        catchError(() => {
          Swal.fire({ icon: 'error', title: 'Error al descargar la plantilla' });
          return of(null);
        })
      )
      .subscribe((response) => {
        if (response && response.body) {
          const blob = new Blob([response.body], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          saveAs(blob, nombreArchivo);
        }
      });
  }

  cargueMasivo(archivo: File, tipo: any) {
    let endpoint;
    if (tipo === 'correctivo') {
      endpoint = `/api/v1/mantenimiento/bulk/correctivo/xlsx`;
    } else if (tipo === 'preventivo') {
      endpoint = `/api/v1/mantenimiento/bulk/preventivo/xlsx`;
    } else {
      endpoint = `/api/v1/mantenimiento/bulk/alistamiento/xlsx`;
    }

    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.api.post(endpoint, formData, true);
  }
}
