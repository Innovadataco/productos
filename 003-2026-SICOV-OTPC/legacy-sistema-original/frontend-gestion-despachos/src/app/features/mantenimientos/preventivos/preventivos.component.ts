import { ChangeDetectionStrategy, Component, computed, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ServiciosMantenimientos } from '../../../mantenimientos/servicios/mantenimientos.service';
import { ServicioLocalStorage } from '../../../administrador/servicios/local-storage.service';
import { ServicioArchivos } from '../../../archivos/servicios/archivos.service';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ModalComponent } from '../../../shared/ui/modal.component';
import { RegistroPreventivoComponent } from './registro-preventivo.component';
import { PaginatorComponent } from '../../../shared/ui/paginator.component';
import { Rol } from 'src/app/autenticacion/modelos/Rol';
import { saveAs } from 'file-saver';
import { ParametricasService, TipoIdentificacion } from 'src/app/parametricas/servicios/parametricas.service';

interface DocumentoItem {
  documento: string;
  ruta: string;
  nombreOriginal: string;
  fecha?: string;
  estado?: boolean;
}

@Component({
  selector: 'app-preventivos-view',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, RegistroPreventivoComponent, PaginatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-column gap-3">
      <!-- Header card eliminado según nueva directriz -->

      <div class="card border-1 shadow-sm" *ngIf="rol?.id === 2 || rol?.id === 1">
        <div class="card-body d-grid gap-3">
          <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <h5 class="card-title mb-0">PDF del programa de mantenimiento preventivo</h5>
            <div class="d-flex align-items-center gap-2">
              <label class="btn-brand btn-brand--sm mb-0">
                <input type="file" class="visualmente-oculto visually-hidden" accept=".pdf" (change)="onFileChange($event)" />
                <i class="bi bi-upload"></i> Cargar archivo
              </label>
              <small class="text-muted">Formato permitido: PDF. Máx 4&nbsp;MB.</small>
            </div>
          </div>

          <div class="d-flex justify-content-end">
            <div class="input-group input-group-sm" style="max-width: 320px;">
              <input type="search" class="form-control" placeholder="Buscar documento" [(ngModel)]="filtroDocs" />
              <button type="button" class="btn-outline-brand btn-brand--sm" (click)="filtroDocs='';" [disabled]="!filtroDocs">Limpiar
              </button>
            </div>
          </div>

          <div class="table-responsive border rounded">
            <table class="table align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Nombre</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let d of documentosPaginados()">
                  <td>{{ d.nombreOriginal }}</td>
                  <td>{{ fechaLegible(d.fecha) }}</td>
                  <td>
                    <span class="badge" [class.text-bg-success]="d.estado" [class.text-bg-secondary]="d.estado === false">
                      {{ d.estado === false ? 'Inactivo' : 'Activo' }}
                    </span>
                  </td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" (click)="descargar(d)">
                      <span><i class="bi bi-download"></i> Descargar</span>
                    </button>
                  </td>
                </tr>
                <tr *ngIf="documentosError">
                  <td colspan="4" class="text-center text-danger py-2">{{ documentosError }}</td>
                </tr>
                <tr *ngIf="documentos.length === 0 && !documentosError">
                  <td colspan="4" class="text-muted text-center">Sin documentos cargados</td>
                </tr>
                <tr *ngIf="documentos.length && !documentosFiltrados().length">
                  <td colspan="4" class="text-muted text-center">Sin resultados</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center" *ngIf="documentosFiltrados().length">
            <small class="text-muted">Mostrando {{ documentosRango().desde }}–{{ documentosRango().hasta }} de {{ documentosRango().total }}</small>
            <app-paginator
              [page]="docsPage"
              [total]="documentosFiltrados().length"
              [pageSize]="docsPageSize"
              [showSummary]="false"
              storageKey="preventivos_docs"
              (pageChange)="docsPage=$event"
              (pageSizeChange)="docsPageSize=$event"
            />
          </div>
        </div>
      </div>

      <!-- Vehículos (reemplaza historial inline) -->
      <div class="card border-1 shadow-sm" *ngIf="rol?.id === 3 || rol?.id === 1">
        <div class="card-body d-grid gap-3">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Vehículos</h5>
            <div class="text-muted small" *ngIf="rangoActual.total">
              Mostrando {{ rangoActual.desde }}–{{ rangoActual.hasta }} de {{ rangoActual.total }}
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex flex-column align-items-start gap-1 border rounded p-3">
              <label for="masivo" class="fw-semibold">Cargue masivo</label>
              <div id="masivo" class="d-flex align-items-center gap-2">
                <label class="btn-brand btn-brand--sm mb-0">
                  <input
                    type="file"
                    class="visualmente-oculto visually-hidden"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    (change)="onFileChangeMasivo($event)"
                  />
                  <i class="bi bi-upload"></i> Cargar archivo
                </label>
                <small class="text-muted">Formato permitido: XLSX.</small>
              </div>
              <div class="d-flex align-items-center gap-2">
                <a class="link" style="cursor: pointer;" (click)="descargarPlantillaMasivo()">
                  Descargar plantilla
                </a>
                <i class="bi bi-info-circle icon-info" (click)="mostrarInfo()" title="Información de la plantilla"></i>
              </div>
            </div>
            <div class="input-group input-group-sm" style="max-width: 320px;">
              <input type="search" class="form-control" placeholder="Placa, fecha o estado" [(ngModel)]="filtro" (ngModelChange)="page=1" />
              <button type="button" class="btn-outline-brand btn-brand--sm" (click)="filtro=''; page=1" [disabled]="!filtro">Limpiar</button>
            </div>
          </div>

          <div class="table-responsive border rounded">
            <table class="table align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width: 60px;">#</th>
                  <th>Placa</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngIf="registrosLoading">
                  <td colspan="5" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status" aria-label="Cargando registros"></div>
                  </td>
                </tr>
                <tr *ngIf="registrosError">
                  <td colspan="5" class="text-center text-danger py-4">{{ registrosError }}</td>
                </tr>
                <!-- <tr *ngIf="!documentos.length">
                  <td colspan="5" class="text-center text-muted py-4">Debe cargar el programa de mantenimiento preventivo.</td>
                </tr> -->
                <tr *ngIf="documentos.length && !registrosError">
                  <td *ngIf="!registrosLoading && !registros.length" colspan="5" class="text-center text-muted py-4">No hay vehículos disponibles.</td>
                  <td *ngIf="!registrosLoading && registros.length && !registrosPaginados().length" colspan="5" class="text-center text-muted py-4">Sin resultados</td>
                </tr>
                <tr *ngFor="let registro of registrosPaginados(); let idx = index">
                  <td>{{ (page - 1) * pageSize + idx + 1 }}</td>
                  <td class="fw-semibold">{{ registro.placa }}</td>
                  <td>{{ fechaLegible(registro.fecha) }}</td>
                  <td>{{ estadoTexto(registro) }}</td>
                  <td class="text-end d-flex justify-content-end gap-2">
                    <button class="btn-brand btn-brand--sm" type="button" (click)="abrirFormularioNuevo(registro)">
                      <i class="bi bi-plus-lg"></i> Registrar mantenimiento
                    </button>
                    <button class="btn-outline-brand btn-brand--sm" type="button" (click)="abrirHistorial(registro)">
                      <i class="bi bi-clock-history"></i> Historial
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="d-flex justify-content-between align-items-center" *ngIf="registrosFiltrados().length">
            <small class="text-muted">Mostrando {{ rangoActual.desde }} – {{ rangoActual.hasta }} de {{ rangoActual.total }}</small>
            <app-paginator
              [page]="page"
              [total]="registrosFiltrados().length"
              [pageSize]="pageSize"
              [showSummary]="false"
              storageKey="preventivos_registros"
              (pageChange)="page=$event"
              (pageSizeChange)="pageSize=$event"
            />
          </div>
        </div>
      </div>

      <!-- Modal de historial -->
      <app-modal [open]="historialOpen()" [title]="'Historial de mantenimiento preventivo - ' + placaFiltro" size="xl" (closed)="historialOpen.set(false)">
        <div class="d-flex align-items-center gap-2 mb-3 justify-content-end">
          <div class="input-group input-group-sm" style="max-width: 240px;">
            <label for="historialBuscarPrev" class="visually-hidden">Buscar</label>
            <input id="historialBuscarPrev" type="search" class="form-control form-control-sm" placeholder="Buscar..."
             [(ngModel)]="terminoHistorial" (ngModelChange)="filtrarHistorial()" />
          </div>
          <div class="d-flex align-items-center gap-2">
            <input type="date" class="form-control form-control-sm" [(ngModel)]="fechaHistorial" (ngModelChange)="filtrarHistorial()"/>
          </div>
          <button class="btn btn-sm btn-outline-secondary" (click)="limpiarFiltrosHistorial()" [disabled]="!terminoHistorial && !fechaHistorial">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="table-responsive border rounded">
          <table class="table align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>NIT</th>
                <th>Razón Social</th>
                <th>Responsable</th>
                <th>Detalle Actividades</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="!historial.length">
                <td colspan="7" class="text-center text-muted">No hay registros disponibles</td>
              </tr>
              <tr *ngFor="let r of pagedHistorial(); let i = index">
                <td>{{ (pageHistoral-1)*pageSizeHistorial + i + 1 }}</td>
                <td>{{ (r.fecha?.split('T')[0]) | date: 'dd/MM/yyyy' }}</td>
                <td>{{ r.hora }}</td>
                <td>{{ r.nit }}</td>
                <td>{{ r.razon_social || r.razonSocial }}</td>
                <td>
                  <div class="fw-semibold">{{ r.nombres_responsable }}</div>
                  <div class="text-muted small" *ngIf="getIdentText(r.tipo_identificacion, r.numero_identificacion)">
                    {{ getIdentText(r.tipo_identificacion, r.numero_identificacion) }}
                  </div>
                </td>
                <td style="max-width: 300px; white-space: pre-wrap;">{{ r.detalle_actividades || r.detalleActividades }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-2" *ngIf="historial.length">
          <div class="text-muted small">Mostrando {{ (pageHistoral-1)*pageSizeHistorial + 1 }} – {{ endIndex() }} de {{ historial.length }}</div>
          <app-paginator
            [page]="pageHistoral"
            [total]="historial.length"
            [pageSize]="pageSizeHistorial"
            [showSummary]="false"
            storageKey="preventivos_historial"
            (pageChange)="pageHistoral=$event"
            (pageSizeChange)="pageSizeHistorial=$event"
          />
        </div>
      </app-modal>

      <!-- Modal de registro -->
      <app-modal [open]="isRegistroOpen()" [title]="placaSeleccionada ? 'Nuevo mantenimiento preventivo — Placa: ' + placaSeleccionada : 'Nuevo mantenimiento preventivo'" size="xl" (closed)="isRegistroOpen.set(false)">
        <app-registro-preventivo [inModal]="true" [initialPlaca]="placaSeleccionada" [resetToken]="registroReset" [modalOpen]="isRegistroOpen()" (saved)="onRegistroSaved()" (closed)="isRegistroOpen.set(false)"></app-registro-preventivo>
      </app-modal>
    </div>
  `,
})
export class PreventivosComponent {
  private readonly api = inject(ServiciosMantenimientos);
  private readonly storage = inject(ServicioLocalStorage);
  private readonly archivos = inject(ServicioArchivos);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly parametricas = inject(ParametricasService);

  rol: Rol | null = this.storage.obtenerRol();

  documentos: DocumentoItem[] = [];
  documentosError: string | null = null;
  private readonly TIPO_PREVENTIVO = 1;
  placaFiltro = '';
  placaSeleccionada: string | undefined;
  page = 1;
  pageSize = 5;
  historial: any[] = [];
  historialBase: any[] = [];
  pageHistoral = 1;
  pageSizeHistorial = 5;
  // Paginación de documentos
  docsPage = 1;
  docsPageSize = 5;
  isRegistroOpen = signal(false);
  historialOpen = signal(false);
  // Token para forzar reinicio del formulario hijo
  registroReset = 0;
  idTypes: TipoIdentificacion[] = [];

  // Documentos filter
  filtroDocs = '';
  documentosFiltrados() {
    const q = (this.filtroDocs || '').toLowerCase();
    if (!q) return this.documentos;
    return this.documentos.filter((d) => (d.nombreOriginal || '').toLowerCase().includes(q));
  }
  documentosPaginados() {
    const start = (this.docsPage - 1) * this.docsPageSize;
    return this.documentosFiltrados().slice(start, start + this.docsPageSize);
  }
  documentosTotalPaginas() {
    const t = this.documentosFiltrados().length;
    return t ? Math.max(1, Math.ceil(t / this.docsPageSize)) : 1;
  }
  documentosPaginaAnterior() { if (this.docsPage > 1) this.docsPage--; }
  documentosPaginaSiguiente() { if (this.docsPage < this.documentosTotalPaginas()) this.docsPage++; }
  documentosRango() {
    const total = this.documentosFiltrados().length;
    if (!total) return { desde: 0, hasta: 0, total };
    const desde = (this.docsPage - 1) * this.docsPageSize + 1;
    const hasta = Math.min(desde + this.docsPageSize - 1, total);
    return { desde, hasta, total };
  }

  // Vehículos list
  registros: any[] = [];
  registrosLoading = false;
  registrosError: string | null = null;
  filtro = '';
  pageSizeVeh = 7;
  get pageSizeVehiculos() { return this.pageSizeVeh; }

  ngOnInit() {
    this.cargarLista();
    this.cargarRegistros();
    this.parametricas.obtenerTipoIdentificaciones().subscribe((res) => {
      this.idTypes = res ?? [];
    });
  }

  registrosFiltrados() {
    const term = (this.filtro || '').trim().toLowerCase();
    if (!term) return this.registros;
    return this.registros.filter((r) => {
      const placa = (r.placa || '').toLowerCase();
      const fecha = this.fechaLegible(r.fecha).toLowerCase();
      const estado = this.estadoTexto(r).toLowerCase();
      return placa.includes(term) || fecha.includes(term) || estado.includes(term);
    });
  }
  registrosPaginados() {
    const start = (this.page - 1) * this.pageSize;
    return this.registrosFiltrados().slice(start, start + this.pageSize);
  }
  totalPaginas() { const t = this.registrosFiltrados().length; return t ? Math.max(1, Math.ceil(t / this.pageSize)) : 1; }
  paginaAnterior() { if (this.page > 1) this.page--; }
  paginaSiguiente() { if (this.page < this.totalPaginas()) this.page++; }
  get rangoActual() {
    const total = this.registrosFiltrados().length;
    if (!total) return { desde: 0, hasta: 0, total };
    const desde = (this.page - 1) * this.pageSize + 1;
    const hasta = Math.min(desde + this.pageSize - 1, total);
    return { desde, hasta, total };
  }

  private cargarLista() {
    const usuario = this.storage.obtenerUsuario();
    const vigilado = usuario?.usuario; // En legacy usaban usuario como vigiladoId
    if (!vigilado) {
      this.documentos = this.getDocumentosMock();
      this.cdr.markForCheck();
      return;
    }
    this.api
      .listarDocumentos(this.TIPO_PREVENTIVO, vigilado)
      .pipe(
        finalize(() => this.cdr.markForCheck())
      )
      .subscribe({
        next: (res: any) => {
        const listaCruda: any[] = Array.isArray(res) ? res : [];
        const lista: DocumentoItem[] = listaCruda.map(d => ({
          documento: d.documento,
          ruta: d.ruta,
          nombreOriginal: d.nombreOriginal,
          fecha: d.fecha,
          estado: d.estado,
        }));
        this.documentosError = null;
        this.documentos = lista.length ? lista : this.getDocumentosMock();
      },
      error: (err) => {
        if (err instanceof HttpErrorResponse && +err.error.error === 401) {
            console.log('Error 401 detectado en preventivos');
            this.registrosError = (err.error?.mensaje ?? err.message ?? 'Acceso no autorizado').toString();
            console.log('Mensaje de error establecido en preventivos:', this.registrosError);
          } else {
            this.registrosError = null;
          }
      }
      });
  }

  private cargarRegistros() {
    const usuario = this.storage.obtenerUsuario();
    const vigilado = usuario?.usuario;
    const rolId = this.storage.obtenerRol()?.id;
    if (!vigilado) {
      this.registros = this.getRegistrosMock();
      this.registrosLoading = false;
      this.cdr.markForCheck();
      return;
    }
    this.registrosLoading = true;
    const timeout = setTimeout(() => {
      if (this.registrosLoading) {
        this.registros = this.getRegistrosMock();
        this.registrosLoading = false;
        this.cdr.markForCheck();
      }
    }, 2000);

    this.api
      .listarRegistros(this.TIPO_PREVENTIVO, vigilado, rolId)
      .pipe(
        finalize(() => {
          clearTimeout(timeout);
          this.registrosLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next:(res: any) => {
        const lista = Array.isArray(res) ? res : [];
        this.registrosError = null;
        // Backend: { placa, fechaDiligenciamiento, estadoMantenimiento, tipoId, id }
        // Adaptamos a la vista actual que usa 'fecha'
        this.registros = lista.length
          ? lista.map((r: any) => ({ ...r, fecha: r.fechaDiligenciamiento ?? r.fecha ?? null }))
          : this.getRegistrosMock();
      },
      error: (err) => {
        console.log('Error al cargar registros de preventivos (suscripción):', err);
        if (err instanceof HttpErrorResponse && +err.error.error === 401) {
            console.log('Error 401 detectado en preventivos');
            this.registrosError = (err.error?.mensaje ?? err.message ?? 'Acceso no autorizado').toString();
            console.log('Mensaje de error establecido en preventivos:', this.registrosError);
          } else {
            this.registrosError = null;
          }
      }
    });
      console.log('Error al cargar registros de preventivos:', this.registrosError);
  }

  private getRegistrosMock() {
    const hoy = Date.now();
    const d = (dias: number) => new Date(hoy - dias * 24 * 60 * 60 * 1000).toISOString();
    return [];
  }

  onFileChange(evt: Event) {
    const input = evt.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (file.type !== 'application/pdf') {
      Swal.fire({ icon: 'warning', title: 'Formato inválido', text: 'Solo se permite PDF.' });
      input.value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'El archivo pesa más de 4Mb' });
      input.value = '';
      return;
    }
    const usuario = this.storage.obtenerUsuario();
    const vigilado = usuario?.usuario;
    if (!vigilado) return;

    Swal.fire({ title: 'Cargando archivo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    this.archivos.guardarArchivo(file, 'sicov', vigilado).subscribe({
      next: (resp) => {
        this.api
          .guardarArchivo(this.TIPO_PREVENTIVO, resp.nombreAlmacenado, resp.nombreOriginalArchivo, resp.ruta, vigilado)
          .subscribe({
            next: () => {
              Swal.fire({ icon: 'success', title: 'Archivo cargado', timer: 1200, showConfirmButton: false });
              input.value = '';
              this.cargarLista();
            },
            error: () => {
              Swal.fire({ icon: 'error', title: 'Error al guardar el archivo' });
            },
          });
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error al subir el archivo' }),
    });
  }

  mostrarInfo() {
    this.api.descripcionPlantillaMasivo('preventivo');
  }

  descargarPlantillaMasivo() {
    const url = '/api/v1/mantenimiento/plantillas/preventivo-correctivo'
    const nombreArchivo = 'plantilla_mantenimiento_preventivo.xlsx';
    this.api.descargarPlantillaMasivo(url, nombreArchivo)
  }

  onFileChangeMasivo(evt: Event) {
    const input = evt.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !file.name.endsWith('.xlsx')) {
      Swal.fire({ icon: 'warning', title: 'Formato inválido', text: 'Solo se permite XLSX.' });
      input.value = '';
      return;
    }
    const usuario = this.storage.obtenerUsuario();
    const vigilado = usuario?.usuario;
    if (!vigilado) return;
    Swal.fire({ title: 'Cargando archivo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    this.api.cargueMasivo(file, 'preventivo').subscribe({
      next: (res) => {
        type CargueMasivoResp = { total: number; exitosos: number; errores: unknown[] };
        const isCargueMasivoResp = (v: unknown): v is CargueMasivoResp =>
          !!v &&
          typeof (v as any).total === 'number' &&
          typeof (v as any).exitosos === 'number' &&
          Array.isArray((v as any).errores);

        const data: CargueMasivoResp = isCargueMasivoResp(res) ? res : { total: 0, exitosos: 0, errores: [] };
        const fallidos = Math.max(0, data.total - data.exitosos);

        let icono: any; let titulo;
        if (fallidos !== 0) {
          if (data.exitosos === 0) {
            icono = 'error';
            titulo = 'Error al procesar la carga masiva';
          } else {
            icono = 'warning';
            titulo = 'Carga masiva procesada con errores';
          }
        } else {
          icono = 'success';
          titulo = 'Carga masiva procesada con éxito';
        }
        Swal.fire({
          icon: icono,
          title: titulo,
          html: 'Se procesaron ' + data.total + ' registros.<br/>' +
                'Exitosos: ' + data.exitosos + '.<br/>' +
                'Fallidos: ' + fallidos + '.<br/>' +
                'Errores a corregir: ' + (data.errores.length || 'Desconocido') + '.',
          showCancelButton: true,
          confirmButtonText: 'Descargar errores',
          cancelButtonText: 'Cerrar'
        }).then((res) => {
          if (res.isConfirmed) {
            this.descargarErroresTxt(data.errores.join('\n'), 'errores_cargue_preventivo.txt');
          }
        });
        input.value = '';
        this.cargarRegistros();
      },
      error: (error) => {
        console.log('Error cargue masivo preventivos:', error.error);
        const errores = Array.isArray(error?.error?.errores) ? error.error.errores : [];
        const erroresTexto = errores.length
          ? errores.map((e: any, idx: number) => `${idx + 1}. ${String(e)}`).join('\n')
          : 'Errores no especificados.';
        const total = Number(error?.error?.total) || 0;
        const exitosos = Number(error?.error?.exitosos) || 0;
        const fallidos = total - exitosos || 0;
        Swal.fire({
          icon: 'error',
          title: 'Error al procesar la carga masiva',
          html: 'Se procesaron ' + total + ' registros.<br/>' +
                'Exitosos: ' + exitosos + '.<br/>' +
                'Fallidos: ' + fallidos + '.<br/>' +
                'Errores a corregir: ' + (errores.length || 'Desconocido') + '.',
          showCancelButton: true,
          confirmButtonText: 'Descargar errores',
          cancelButtonText: 'Cerrar'
        }).then((res) => {
          if (res.isConfirmed) {
            this.descargarErroresTxt(erroresTexto, 'errores_cargue_preventivo.txt');
          }
        });
        input.value = '';
        // Swal.fire({ icon: 'error', title: 'Error al procesar la carga masiva', text: error?.error?.message || '' });
      }
    });
  }

  descargar(d: DocumentoItem) {
    this.archivos.descargarArchivo(d.documento, d.ruta, d.nombreOriginal);
  }


  abrirFormularioNuevo(registro: any) {
  this.placaSeleccionada = (registro?.placa || '').trim() || undefined;
    // incrementar token antes de abrir el modal para que el hijo reinicie
    this.registroReset++;
    this.isRegistroOpen.set(true);
  }

  onRegistroSaved() {
    // Actualizar listado de registros y documentos si aplica
    this.cargarRegistros();
  }

  // Historial
  cargarHistorial() {
    const placa = (this.placaFiltro || '').trim();
    const usuario = this.storage.obtenerUsuario();
    const vigilado = usuario?.usuario;
    if (!placa) return;
    if (!vigilado) {
      this.historial = [];
      this.page = 1;
      this.cdr.markForCheck();
      return;
    }
    this.api
      .historial(this.TIPO_PREVENTIVO, vigilado, placa)
      .pipe(
        catchError(() => of([])),
        finalize(() => this.cdr.markForCheck())
      )
      .subscribe((res: any) => {
        const lista = Array.isArray(res) ? res : [];
        this.historialBase = lista.length ? lista : [];
        this.historial = this.historialBase.slice();
        this.page = 1;
      });
  }

  abrirHistorial(registro: any) {
    this.placaFiltro = registro?.placa || '';
    if (this.placaFiltro) {
      this.cargarHistorial();
      this.historialOpen.set(true);
    }
  }

  exportarHistorial(): string | null {
    const placa = (this.placaFiltro || '').trim();
    const usuario = this.storage.obtenerUsuario();
    const vigilado = usuario?.usuario;
    if (!placa || !vigilado) return null;
    return this.api.exportarHistorial(this.TIPO_PREVENTIVO, vigilado, placa) as string;
  }

  pagedHistorial() {
    const start = (this.pageHistoral - 1) * this.pageSizeHistorial;
    return this.historial.slice(start, start + this.pageSizeHistorial);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.historial.length / this.pageSizeHistorial));
  }

  nextPage() {
    if (this.pageHistoral < this.totalPages()) this.pageHistoral++;
  }

  prevPage() {
    if (this.pageHistoral > 1) this.pageHistoral--;
  }

  endIndex() {
    const end = this.pageHistoral * this.pageSizeHistorial;
    return end > this.historial.length ? this.historial.length : end;
  }

  fechaLegible(fecha?: string | null): string {
    // Normaliza fechas vacías o inválidas
    if (!fecha || !fecha.toString().trim()) return '—';
    if (/^0{4}-0{2}-0{2}/.test(fecha)) return '—';
    let d = new Date(fecha);
    if (Number.isNaN(d.getTime())) {
      // Intento adicional: reemplazar espacio por 'T'
      const alt = fecha.replace(' ', 'T');
      d = new Date(alt);
      if (Number.isNaN(d.getTime())) return '—';
    }
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  estadoTexto(registro: any): string {
    const estadoTexto = (registro?.estadoMantenimiento ?? '').toString().trim();
    if (estadoTexto) return estadoTexto;
    if (typeof registro?.estado === 'boolean') {
      return registro.estado ? 'Activo' : 'Inactivo';
    }
    return '—';
  }

  private toLower(v: any): string { return (v ?? '').toString().toLowerCase(); }

  // Formateo de identificación como en alistamientos
  protected getIdentText(tipo: number, numero: string): string {
    const abbr = this.abbrTipoId(tipo);
    const num = numero == null ? '' : String(numero);
    return abbr ? `${abbr} ${num}` : '';
  }
  private abbrTipoId(tipo: number): string {
    if (tipo == null) return '';
    const raw = String(tipo).trim();
    const upper = this.removeDiacritics(raw).toUpperCase();
    if (['CC','CE','TI','NIT','PAS','PPT','PEP','DIE','RC'].includes(upper)) return upper;
    // Try to resolve via paramétricas list
    const match = this.idTypes.find(t => String(t.id).trim() === raw || String(t.codigo ?? '').trim() === raw);
    if (match) {
      const ab = this.abbrFromDescription(match.nombre);
      if (ab) return ab;
    }
    // Fallback by description keywords
    if (upper.includes('EXTRANJ')) return 'CE';
    if (upper.includes('TARJETA')) return 'TI';
    if (upper.includes('PASAP')) return 'PAS';
    if (upper.includes('REGISTRO')) return 'RC';
    if (upper.includes('NIT')) return 'NIT';
    if (upper.includes('CEDULA')) return 'CC';
    return '';
  }
  private abbrFromDescription(desc?: string | null): string {
    if (!desc) return '';
    const u = this.removeDiacritics(String(desc)).toUpperCase();
    if (u.includes('PERMISO POR PROTECCION TEMPORAL') || u.includes('PPT')) return 'PPT';
    if (u.includes('PERMISO ESPECIAL DE PERMANENCIA') || u.includes('PEP')) return 'PEP';
    if (u.includes('DOCUMENTO DE IDENTIFICACION EXTRANJERO') || u.includes('DIE')) return 'DIE';
    if (u.includes('PASAP')) return 'PAS';
    if (u.includes('EXTRANJ')) return 'CE';
    if (u.includes('TARJETA')) return 'TI';
    if (u.includes('REGISTRO CIVIL')) return 'RC';
    if (u.includes('CEDULA')) return 'CC';
    return '';
  }
  private removeDiacritics(s: string): string {
    return s.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
  }

  terminoHistorial = '';
  fechaHistorial = '';

  filtrarHistorial() {
    // Reset page before applying filters
    this.pageHistoral = 1;
    const term = (this.terminoHistorial || '').trim().toLowerCase();
    const fechaFiltro = (this.fechaHistorial || '').trim();
    let lista = this.historialBase.slice();
    if (term) {
      lista = lista.filter((r) => {
        const nit = this.toLower(r.nit);
        const razonSocial = this.toLower(r.razon_social ?? r.razonSocial);
        const tipoId = this.toLower(r.tipo_identificacion ?? r.tipoIdentificacion);
        const numeroId = this.toLower(r.numero_identificacion ?? r.numeroIdentificacion);
        const nombreIngeniero = this.toLower(r.nombres_responsable ?? r.nombreIngeniero);
        const detalleActividades = this.toLower(r.detalle_actividades ?? r.detalleActividades);
        return nit.includes(term) || razonSocial.includes(term) || tipoId.includes(term) || numeroId.includes(term) || nombreIngeniero.includes(term) || detalleActividades.includes(term);
      });
    }
    if (fechaFiltro) {
      lista = lista.filter((r) => {
        const fechaRegistro = (r.fecha || '').toString().split('T')[0];
        return fechaRegistro === fechaFiltro;
      });
    }
    this.historial = lista;
    // Force change detection and ensure page resets after any child paginator sync
    this.cdr.markForCheck();
    setTimeout(() => {
      this.pageHistoral = 1;
      this.cdr.markForCheck();
    }, 0);
    return this.historial;
  }

  limpiarFiltrosHistorial() {
    this.terminoHistorial = '';
    this.fechaHistorial = '';
    this.pageHistoral = 1;
    this.filtrarHistorial();
  }

  // Mocks
  private getDocumentosMock(): DocumentoItem[] {
    return [];
  }
  isMockDoc(d: DocumentoItem): boolean { return d.ruta === 'mock'; }

  private getHistorialMock(placa: string) {
    const hoy = Date.now();
    const d = (dias: number) => new Date(hoy - dias * 86400000).toISOString();
    return [
      {
        placa,
        fecha: d(3),
        hora: '09:15',
        nit: '800086050',
        razon_social: 'Empresa prueba',
        tipo_identificacion: 'NIT',
        numero_identificacion: '800086050',
        nombres_responsable: 'Ing. Demo Uno',
        detalle_actividades: 'Revisión general y ajuste de niveles.'
      },
      {
        placa,
        fecha: d(15),
        hora: '10:40',
        nit: '800086050',
        razon_social: 'Empresa prueba',
        tipo_identificacion: 'NIT',
        numero_identificacion: '800086050',
        nombres_responsable: 'Ing. Demo Dos',
        detalle_actividades: 'Cambio de filtros y prueba de funcionamiento.'
      }
    ];
  }

  private descargarErroresTxt(contenido: string, nombre: string) {
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = nombre;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
