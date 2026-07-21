import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { finalize, map, switchMap, tap } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { ServicioLocalStorage } from '../../administrador/servicios/local-storage.service';
import { Usuario, Rol } from '../../core/models/auth.models';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PaginatorComponent } from '../../shared/ui/paginator.component';
import { AlistamientosService } from './alistamientos.service';
import {
  AlistamientosFormComponent,
  AlistamientoFormContext,
  SubmitEvent,
} from './alistamientos-form.component';
import { AlistamientosHistorialComponent } from './alistamientos-historial.component';
import {
  AlistamientoDocumento,
  AlistamientoRegistro,
  HistorialAlistamiento,
  ProtocoloAlistamiento,
} from './alistamientos.models';
import { DetallesActividades } from '../../mantenimientos/modelos/RegistroProtocoloAlistamiento';
import {
  ParametricasService,
  TipoIdentificacion,
} from '../../parametricas/servicios/parametricas.service';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { CommonModule } from '@angular/common';

const PAGE_SIZE = 5;
const DOCUMENTOS_PAGE_SIZE = 5;
const HISTORIAL_PAGE_SIZE = 5;
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf'];

interface FormContext extends AlistamientoFormContext {
  mantenimientoId?: string | number;
  vigiladoId: string;
}

@Component({
  selector: 'app-alistamientos-page',
  imports: [
    ModalComponent,
    AlistamientosFormComponent,
    AlistamientosHistorialComponent,
    PageHeaderComponent,
    PaginatorComponent,
    CommonModule,
  ],
  template: `
    <div class="container-fluid py-3">
      <app-page-header
        [title]="'Alistamientos'"
        [subtitle]="'Gestión del protocolo de alistamiento diario y su documentación de soporte.'"
        [usuarioInput]="usuario()"
      />

      <div class="d-grid gap-3">
        <section class="card border-1 shadow-sm" *ngIf="isCliente() || isAdmin()">
          <div class="card-body d-grid gap-3">
            <div
              class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3"
            >
              <div>
                <h5 class="mb-1">PDF del programa de alistamiento diario</h5>
                <!-- <p class="text-muted small mb-0">Carga diaria en PDF, máximo 4&nbsp;MB.</p> -->
              </div>
              <div class="d-flex align-items-center gap-2">
                <label class="btn-brand btn-brand--sm mb-0">
                  <input
                    type="file"
                    class="visually-hidden"
                    accept=".pdf"
                    (change)="onArchivoSeleccionado($event)"
                  />
                  <i class="bi bi-upload"></i> Cargar archivo
                </label>
                <small class="text-muted">Formato permitido: PDF. Máx 4&nbsp;MB.</small>
              </div>
            </div>

            <div class="d-flex justify-content-end">
              <div class="input-group input-group-sm" style="max-width: 320px;">
                <input
                  type="search"
                  class="form-control"
                  placeholder="Documento, fecha o estado"
                  [value]="filtroDocs()"
                  (input)="onDocumentosFilterChange($event)"
                />
                <button
                  type="button"
                  class="btn-outline-brand btn-brand--sm"
                  (click)="limpiarDocumentosFiltro()"
                  [disabled]="!filtroDocs()"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div class="table-responsive border rounded">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Documento</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th class="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @if (documentosLoading()) {
                  <tr>
                    <td colspan="4" class="text-center py-4">
                      <div
                        class="spinner-border text-primary"
                        role="status"
                        aria-label="Cargando documentos"
                      ></div>
                    </td>
                  </tr>
                  } @else if (documentosError()) {
                  <tr>
                    <td colspan="4" class="text-center py-4 text-danger">{{ documentosError() }}</td>
                  </tr>
                  } @else if (!documentos().length && !documentosError()) {
                  <tr>
                    <td colspan="4" class="text-center text-muted py-4">Sin documentos cargados</td>
                  </tr>
                  } @else if (!documentosFiltrados().length) {
                  <tr>
                    <td colspan="4" class="text-center text-muted py-4">Sin resultados</td>
                  </tr>
                  } @else { @for (doc of documentosPaginados(); track doc.id ?? doc.documento) {
                  <tr>
                    <td class="fw-semibold">{{ doc.nombreOriginal }}</td>
                    <td>{{ fechaLegible(doc.fecha) }}</td>
                    <td>
                      <span
                        class="badge"
                        [class.text-bg-success]="doc.estado"
                        [class.text-bg-secondary]="doc.estado === false"
                      >
                        {{ doc.estado === false ? 'Inactivo' : 'Activo' }}
                      </span>
                    </td>
                    <td class="text-end">
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-primary"
                        (click)="descargar(doc)"
                      >
                        <span><i class="bi bi-download"></i> Descargar</span>
                      </button>
                    </td>
                  </tr>
                  } }
                </tbody>
              </table>
            </div>

            @if (!documentosLoading() && documentosFiltrados().length) {
            <div class="d-flex justify-content-between align-items-center">
              <small class="text-muted"
                >Mostrando {{ documentosRango().desde }}–{{ documentosRango().hasta }} de
                {{ documentosRango().total }}</small
              >
              <app-paginator
                [page]="documentosPage()"
                [total]="documentosFiltrados().length"
                [pageSize]="documentosPageSize()"
                [showSummary]="false"
                storageKey="alistamientos_docs"
                (pageChange)="documentosPage.set($event)"
                (pageSizeChange)="documentosPageSize.set($event)"
              />
            </div>
            }
          </div>
        </section>

        <section class="card border-1 shadow-sm" *ngIf="isOperador() || isAdmin()">
          <div class="card-body d-grid gap-3">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Vehículos</h5>
              @if (rangoActual().total) {
              <div class="text-muted small">
                Mostrando {{ rangoActual().desde }}–{{ rangoActual().hasta }} de
                {{ rangoActual().total }}
              </div>
              }
            </div>

            <div class="d-flex justify-content-between align-items-center">
              <div class="d-flex flex-column align-items-start gap-1 border rounded p-3">
                <label for="masivo" class="fw-semibold">Cargue masivo</label>
                <div id="masivo" class="d-flex align-items-center gap-2">
                  <label class="btn-brand btn-brand--sm mb-0">
                    <input
                      type="file"
                      class="visualmente-oculto visually-hidden"
                      accept=".xlsx"
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
                <input
                  type="search"
                  class="form-control"
                  placeholder="Placa, fecha o estado"
                  [value]="filtro()"
                  (input)="onFilterChange($event)"
                />
                <button
                  type="button"
                  class="btn-outline-brand btn-brand--sm"
                  (click)="limpiarFiltro()"
                  [disabled]="!filtro()"
                >
                  Limpiar
                </button>
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
                  @if (registrosLoading()) {
                  <tr>
                    <td colspan="5" class="text-center py-4">
                      <div
                        class="spinner-border text-primary"
                        role="status"
                        aria-label="Cargando registros"
                      ></div>
                    </td>
                  </tr>
                  } @else if (registrosError()) {
                  <tr>
                    <td colspan="5" class="text-center py-4 text-danger">{{ registrosError() }}</td>
                  </tr>
                  } @else if (!registros().length) {
                  <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                      {{
                        !documentos().length
                          ? 'Carga el protocolo para habilitar los vehículos.'
                          : 'No hay vehículos disponibles.'
                      }}
                    </td>
                  </tr>
                  } @else if (!registrosFiltrados().length) {
                  <tr>
                    <td colspan="5" class="text-center text-muted py-4">Sin resultados</td>
                  </tr>
                  } @else { @for (registro of registrosPaginados(); track registro.placa ?? ($index
                  + 1); let idx = $index) {
                  <tr>
                    <td>{{ (page() - 1) * pageSize() + idx + 1 }}</td>
                    <td class="fw-semibold">{{ registro.placa }}</td>
                    <td>{{ fechaLegible(registro.fechaDiligenciamiento) }}</td>
                    <td>{{ estadoTexto(registro) }}</td>
                    <td class="text-end d-flex justify-content-end gap-2">
                      <button
                        class="btn-brand btn-brand--sm"
                        type="button"
                        (click)="abrirFormularioNuevo(registro)"
                      >
                        <i class="bi bi-plus-lg"></i> Registrar alistamiento
                      </button>
                      <button
                        class="btn-outline-brand btn-brand--sm"
                        type="button"
                        (click)="abrirHistorial(registro)"
                      >
                        <i class="bi bi-clock-history"></i> Historial
                      </button>
                    </td>
                  </tr>
                  } }
                </tbody>
              </table>
            </div>

            @if (registrosFiltrados().length) {
            <div class="d-flex justify-content-between align-items-center">
              <small class="text-muted"
                >Mostrando {{ rangoActual().desde }}–{{ rangoActual().hasta }} de
                {{ rangoActual().total }}</small
              >
              <app-paginator
                [page]="page()"
                [total]="registrosFiltrados().length"
                [pageSize]="pageSize()"
                [showSummary]="false"
                storageKey="alistamientos_registros"
                (pageChange)="page.set($event)"
                (pageSizeChange)="pageSize.set($event)"
              />
            </div>
            }
          </div>
        </section>
      </div>

      <app-modal
        [open]="formAbierto()"
        [title]="formTitulo()"
        size="xl"
        (closed)="cerrarFormulario()"
        [requiredAllData]="true"
      >
        @if (formAbierto() && formViewContext()) {
        <app-alistamientos-form
          [context]="formViewContext()"
          [actividades]="actividades()"
          [tiposIdentificacion]="tiposIdentificacion()"
          [saving]="guardandoFormulario()"
          (submit)="onFormSubmit($event)"
          (cancel)="cerrarFormulario()"
        />
        } @else {
        <div class="py-5 text-center text-muted">Selecciona un registro para continuar.</div>
        }
      </app-modal>

      <app-modal
        [open]="historialAbierto()"
        [title]="'Historial de alistamiento' + (historialPlaca() ? ' - ' + historialPlaca() : '')"
        size="xl"
        (closed)="cerrarHistorial()"
      >
        <app-alistamientos-historial
          [records]="historial()"
          [placa]="historialPlaca()"
          [loading]="historialLoading()"
          [exportUrl]="historialExport()"
          [pageSize]="${HISTORIAL_PAGE_SIZE}"
          [idTypes]="tiposIdentificacion()"
          (ver)="abrirEdicionDesdeHistorial($event)"
        ></app-alistamientos-historial>
      </app-modal>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlistamientosPageComponent {
  private readonly storage = inject(ServicioLocalStorage);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(AlistamientosService);
  private readonly parametricas = inject(ParametricasService);

  private readonly fechaFormatter = new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  protected readonly usuario = signal<Usuario | null>(null);
  protected readonly rol = signal<Rol | null>(null);
  protected readonly documentos = signal<AlistamientoDocumento[]>([]);
  protected readonly documentosLoading = signal(false);
  protected readonly documentosError = signal<string | null>(null);
  protected readonly documentosPage = signal(1);
  protected readonly documentosPageSize = signal(5);
  protected readonly filtroDocs = signal('');
  protected readonly subiendoArchivo = signal(false);
  protected readonly registros = signal<AlistamientoRegistro[]>([]);
  protected readonly registrosLoading = signal(false);
  protected readonly registrosError = signal<string | null>(null);
  protected readonly filtro = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly verificador = signal(false);
  protected readonly actividades = signal<DetallesActividades[]>([]);
  protected readonly tiposIdentificacion = signal<TipoIdentificacion[]>([]);
  protected readonly historial = signal<HistorialAlistamiento[]>([]);
  protected readonly historialLoading = signal(false);
  protected readonly historialPlaca = signal('');
  protected readonly historialExport = signal<string | null>(null);
  protected readonly historialAbierto = signal(false);
  protected readonly formContext = signal<FormContext | null>(null);
  protected readonly guardandoFormulario = signal(false);

  protected readonly documentosFiltrados = computed(() => {
    const term = this.filtroDocs().trim().toLowerCase();
    const lista = this.documentos();
    if (!term) return lista;
    return lista.filter((doc) => {
      const nombre = (doc.nombreOriginal ?? '').toLowerCase();
      const fecha = this.fechaLegible(doc.fecha).toLowerCase();
      const estado = doc.estado === false ? 'inactivo' : 'activo';
      return nombre.includes(term) || fecha.includes(term) || estado.includes(term);
    });
  });

  protected readonly documentosPaginados = computed(() => {
    const lista = this.documentosFiltrados();
    const size = Math.max(1, this.documentosPageSize());
    const start = (this.documentosPage() - 1) * size;
    return lista.slice(start, start + size);
  });

  protected readonly documentosTotalPaginas = computed(() => {
    const total = this.documentosFiltrados().length;
    const size = Math.max(1, this.documentosPageSize());
    return total ? Math.max(1, Math.ceil(total / size)) : 1;
  });

  protected readonly documentosRango = computed(() => {
    const total = this.documentosFiltrados().length;
    if (!total) return { desde: 0, hasta: 0, total };
    const size = Math.max(1, this.documentosPageSize());
    const desde = (this.documentosPage() - 1) * size + 1;
    const hasta = Math.min(desde + size - 1, total);
    return { desde, hasta, total };
  });

  private lastVigilado: string | null = null;

  protected readonly isAdmin = computed(() => {
    const id = this.rol()?.id;
    if (Number(id) === 1) console.log('ROL ID:', id, 'ES ADMIN');
    return Number(id) === 1;
  });
  protected readonly isOperador = computed(() => {
    const id = this.rol()?.id;
    if (Number(id) === 3) console.log('ROL ID:', id, 'ES OPERADOR');
    return Number(id) === 3;
  });
  protected readonly isCliente = computed(() => {
    const id = this.rol()?.id;
    if (Number(id) === 2) console.log('ROL ID:', id, 'ES CLIENTE');
    return Number(id) === 2;
  });

  protected readonly registrosFiltrados = computed(() => {
    const term = this.filtro().trim().toLowerCase();
    const registros = this.registros();
    if (!term) return registros;
    return registros.filter((registro) => {
      const placa = (registro.placa ?? '').toLowerCase();
      const fecha = this.fechaLegible(registro.fechaDiligenciamiento).toLowerCase();
      const estado = this.estadoTexto(registro).toLowerCase();
      return placa.includes(term) || fecha.includes(term) || estado.includes(term);
    });
  });

  protected readonly registrosPaginados = computed(() => {
    const lista = this.registrosFiltrados();
    const size = Math.max(1, this.pageSize());
    const start = (this.page() - 1) * size;
    return lista.slice(start, start + size);
  });

  protected readonly totalPaginas = computed(() => {
    const total = this.registrosFiltrados().length;
    const size = Math.max(1, this.pageSize());
    return total ? Math.max(1, Math.ceil(total / size)) : 1;
  });

  protected readonly rangoActual = computed(() => {
    const total = this.registrosFiltrados().length;
    if (!total) return { desde: 0, hasta: 0, total };
    const size = Math.max(1, this.pageSize());
    const desde = (this.page() - 1) * size + 1;
    const hasta = Math.min(desde + size - 1, total);
    return { desde, hasta, total };
  });

  protected readonly formAbierto = computed(() => this.formContext() !== null);

  protected readonly formViewContext = computed<AlistamientoFormContext | null>(() => {
    const ctx = this.formContext();
    if (!ctx) return null;
    return { placa: ctx.placa, modo: ctx.modo, initial: ctx.initial ?? null };
  });

  protected readonly formTitulo = computed(() => {
    const ctx = this.formContext();
    if (!ctx) return 'Registro de alistamiento';
    return ctx.modo === 'edit'
      ? `Editar alistamiento (${ctx.placa})`
      : `Nuevo alistamiento (${ctx.placa})`;
  });

  constructor() {
    this.rol.set(this.storage.obtenerRol());
    this.usuario.set(this.storage.obtenerUsuario());

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const rawUsuario = params.get('usuario');
      if (!rawUsuario) return;
      try {
        const parsed = JSON.parse(rawUsuario) as Usuario;
        this.usuario.set(parsed);
      } catch {
        console.warn('No se pudo interpretar el usuario recibido en la ruta.');
      }
    });

    effect(() => {
      const vigilado = this.usuario()?.usuario;
      if (!vigilado || vigilado === this.lastVigilado) return;
      this.lastVigilado = vigilado;
      this.cargarDocumentos(vigilado);
      this.cargarRegistros(vigilado);
      if (!this.actividades().length) this.cargarActividades();
      if (!this.tiposIdentificacion().length) this.cargarTiposIdentificacion();
    });

    effect(() => {
      const totalPaginas = this.totalPaginas();
      const paginaActual = this.page();
      if (paginaActual > totalPaginas) {
        this.page.set(totalPaginas);
      }
    });

    effect(() => {
      const total = this.documentosTotalPaginas();
      const actual = this.documentosPage();
      if (actual > total) {
        this.documentosPage.set(total);
      } else if (actual < 1) {
        this.documentosPage.set(1);
      }
    });
  }

  protected onFilterChange(event: Event) {
    const valor = (event.target as HTMLInputElement).value ?? '';
    this.filtro.set(valor);
    this.page.set(1);
  }

  protected limpiarFiltro() {
    this.filtro.set('');
    this.page.set(1);
  }

  protected onDocumentosFilterChange(event: Event) {
    const valor = (event.target as HTMLInputElement).value ?? '';
    this.filtroDocs.set(valor);
    this.documentosPage.set(1);
  }

  protected limpiarDocumentosFiltro() {
    this.filtroDocs.set('');
    this.documentosPage.set(1);
  }

  protected paginaAnterior() {
    if (this.page() > 1) this.page.update((current) => current - 1);
  }

  protected paginaSiguiente() {
    if (this.page() < this.totalPaginas()) this.page.update((current) => current + 1);
  }

  protected documentosPaginaAnterior() {
    if (this.documentosPage() > 1) this.documentosPage.update((current) => current - 1);
  }

  protected documentosPaginaSiguiente() {
    if (this.documentosPage() < this.documentosTotalPaginas()) {
      this.documentosPage.update((current) => current + 1);
    }
  }

  protected fechaLegible(fecha?: string | null): string {
    if (!fecha) return '';
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return '';
    return this.fechaFormatter.format(date);
  }

  protected estadoTexto(registro: AlistamientoRegistro): string {
    const estadoTexto = (registro.estadoMantenimiento ?? '').toString().trim();
    if (estadoTexto) return estadoTexto;
    if (typeof (registro as { estado?: boolean }).estado === 'boolean') {
      return (registro as { estado: boolean }).estado ? 'Activo' : 'Inactivo';
    }
    return '—';
  }

  protected descargar(doc: AlistamientoDocumento) {
    this.service.descargarArchivo(doc.documento, doc.ruta, doc.nombreOriginal);
  }

  mostrarInfo() {
    this.service.descripcionPlantillaMasivo('alistamiento');
  }

  descargarPlantillaMasivo() {
    this.service.descargarPlantillaMasivo();
  }

  onFileChangeMasivo(evt: Event) {
    const input = evt.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (
      file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
      !file.name.endsWith('.xlsx')
    ) {
      Swal.fire({ icon: 'warning', title: 'Formato inválido', text: 'Solo se permite XLSX.' });
      input.value = '';
      return;
    }
    const usuario = this.storage.obtenerUsuario();
    const vigilado = usuario?.usuario;
    if (!vigilado) return;
    Swal.fire({
      title: 'Cargando archivo...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    this.service.cargueMasivo(file, 'alistamientos').subscribe({
      next: (res) => {
        type CargueMasivoResp = { total: number; exitosos: number; errores: unknown[] };
        const isCargueMasivoResp = (v: unknown): v is CargueMasivoResp =>
          !!v &&
          typeof (v as any).total === 'number' &&
          typeof (v as any).exitosos === 'number' &&
          Array.isArray((v as any).errores);

        const data: CargueMasivoResp = isCargueMasivoResp(res)
          ? res
          : { total: 0, exitosos: 0, errores: [] };
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
            this.descargarErroresTxt(data.errores.join('\n'), 'errores_cargue_alistamientos.txt');
          }
        });
        input.value = '';
        this.cargarRegistros(vigilado);
      },
      error: (error) => {
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
            this.descargarErroresTxt(erroresTexto, 'errores_cargue_alistamientos.txt');
          }
        });
        input.value = '';
      },
    });
  }

  protected onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || !files.length) return;
    const file = files[0];
    input.value = '';

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      Swal.fire({ icon: 'warning', title: 'Selecciona un archivo PDF válido.' });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      Swal.fire({ icon: 'warning', title: 'El archivo supera los 4 MB permitidos.' });
      return;
    }

    const vigilado = this.usuario()?.usuario;
    if (!vigilado) {
      Swal.fire({ icon: 'error', title: 'No encontramos el identificador del vigilado.' });
      return;
    }

    this.subiendoArchivo.set(true);
    Swal.fire({ title: 'Cargando archivo...', didOpen: () => Swal.showLoading() });
    this.service
      .subirArchivo(file, vigilado)
      .pipe(
        switchMap((respuesta) =>
          this.service.guardarArchivoMetadata(
            respuesta.nombreAlmacenado,
            respuesta.nombreOriginalArchivo,
            respuesta.ruta,
            vigilado
          )
        ),
        finalize(() => this.subiendoArchivo.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Archivo cargado correctamente',
            timer: 1500,
            showConfirmButton: false,
          });
          this.cargarDocumentos(vigilado);
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'No fue posible cargar el archivo' });
        },
      });
  }

  protected abrirFormularioNuevo(registro: AlistamientoRegistro) {
    const vigilado = this.usuario()?.usuario;
    if (!vigilado || !registro.placa) return;
    // Siempre crear un nuevo objeto para forzar reset en el formulario hijo
    this.formContext.set({
      placa: registro.placa,
      modo: 'create',
      mantenimientoId: registro.mantenimiento_id,
      vigiladoId: vigilado,
      initial: null,
    });
  }

  protected cerrarFormulario() {
    this.formContext.set(null);
  }

  protected onFormSubmit(evento: SubmitEvent) {
    if (this.guardandoFormulario()) return; // evita envíos duplicados por doble submit/click
    const ctx = this.formContext();
    if (!ctx) return;
    const vigilado = ctx.vigiladoId;
    const placa = ctx.placa;
    if (!vigilado || !placa) return;

    this.guardandoFormulario.set(true);

    const mantenimiento$ = ctx.mantenimientoId
      ? of(ctx.mantenimientoId)
      : this.service.crearMantenimiento(vigilado, placa).pipe(
          tap((resp) => {
            const actualizado: FormContext = { ...ctx, mantenimientoId: resp.id };
            this.formContext.set(actualizado);
          }),
          map((resp) => resp.id)
        );

    mantenimiento$
      .pipe(
        switchMap((mantenimientoId) =>
          this.service.guardarAlistamiento(evento.protocolo, mantenimientoId)
        ),
        finalize(() => this.guardandoFormulario.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: evento.modo === 'edit' ? 'Alistamiento actualizado' : 'Alistamiento registrado',
            timer: 1600,
            showConfirmButton: false,
          });
          this.cerrarFormulario();
          this.cargarRegistros(vigilado);
          if (this.historialAbierto() && this.historialPlaca() === placa) {
            this.cargarHistorial(vigilado, placa);
          }
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'No fue posible guardar la información' });
        },
      });
  }

  protected abrirHistorial(registro: AlistamientoRegistro) {
    const vigilado = this.usuario()?.usuario;
    if (!vigilado || !registro.placa) return;
    this.historialPlaca.set(registro.placa);
    this.historialAbierto.set(true);
    this.historial.set([]);
    this.historialExport.set(this.service.exportarHistorial(vigilado, registro.placa));
    this.cargarHistorial(vigilado, registro.placa);
  }

  protected cerrarHistorial() {
    this.historialAbierto.set(false);
  }

  protected abrirEdicionDesdeHistorial(item: HistorialAlistamiento) {
    const vigilado = this.usuario()?.usuario;
    if (!vigilado || !item.placa || item.mantenimiento_id === undefined) return;

    this.historialAbierto.set(false);
    this.guardandoFormulario.set(true);

    this.service
      .visualizarAlistamiento(item.mantenimiento_id)
      .pipe(
        finalize(() => this.guardandoFormulario.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (protocolo) => {
          this.formContext.set({
            placa: item.placa ?? '',
            modo: 'edit',
            mantenimientoId: item.mantenimiento_id,
            vigiladoId: vigilado,
            initial: protocolo,
          });
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'No fue posible cargar el registro seleccionado' });
        },
      });
  }

  private cargarDocumentos(vigilado: string) {
    this.documentosLoading.set(true);
    this.service
      .listarDocumentos(vigilado)
      .pipe(
        finalize(() => this.documentosLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (docs) => {
          const lista = Array.isArray(docs) ? docs : [];
          this.documentosError.set(null);
          this.documentos.set(lista.length ? lista : []);
          this.documentosPage.set(1);
        },
        error: (error) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            const msg = (error.error?.mensaje ?? error.message ?? 'Acceso no autorizado').toString();
            this.documentosError.set(msg);
          } else {
            this.documentosError.set(null);
          }
          this.documentos.set([]);
          this.documentosPage.set(1);
        },
      });
  }

  private cargarRegistros(vigilado: string) {
    this.registrosLoading.set(true);
    this.service
      .listarRegistros(vigilado, this.rol()?.id ?? null)
      .pipe(
        finalize(() => this.registrosLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (registros) => {
          const lista = Array.isArray(registros) ? registros : [];
          this.registrosError.set(null);
          if (lista.length) {
            this.verificador.set(false);
            this.registros.set(lista);
          } else {
            this.registros.set([]);
          }
        },
        error: (error) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.registros.set([]);
            this.verificador.set(true);
            this.registrosError.set(null);
          } else if (error instanceof HttpErrorResponse && error.status === 401) {
            const msg = (error.error?.mensaje ?? error.message ?? 'Acceso no autorizado').toString();
            this.registrosError.set(msg);
            this.registros.set([]);
          } else {
            this.registrosError.set(null);
            Swal.fire({ icon: 'error', title: 'No fue posible obtener los registros' });
          }
        },
      });
  }

  private cargarHistorial(vigilado: string, placa: string) {
    this.historialLoading.set(true);
    this.service
      .listarHistorial(vigilado, placa)
      .pipe(
        finalize(() => this.historialLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (historial) => {
          const lista = Array.isArray(historial) ? historial : [];
          if (lista.length) {
            this.historial.set(lista);
          } else {
            this.historial.set([]);
          }
        },
        error: () => {
          this.historial.set([]);
          Swal.fire({ icon: 'error', title: 'No fue posible cargar el historial' });
        },
      });
  }

  private cargarActividades() {
    this.service
      .listarActividades()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actividades) => {
          const lista = Array.isArray(actividades) ? actividades : [];
          this.actividades.set(lista.length ? lista : []);
        },
        error: () => {
          console.warn('No fue posible obtener las actividades del protocolo.');
        },
      });
  }

  private cargarTiposIdentificacion() {
    this.parametricas
      .obtenerTipoIdentificaciones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tipos) => {
          const lista = Array.isArray(tipos) ? tipos : [];
          this.tiposIdentificacion.set(lista.length ? lista : []);
        },
        error: () => {
          console.warn('No fue posible obtener los tipos de identificación.');
        },
      });
  }

  private descargarErroresTxt(contenido: string, nombre = 'errores_cargue.txt') {
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = nombre;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
