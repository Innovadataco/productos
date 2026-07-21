import { AfterViewInit, ChangeDetectionStrategy, Component, inject, OnInit, ChangeDetectorRef, computed, signal, DestroyRef } from '@angular/core';
import { PageHeaderComponent } from 'src/app/shared/ui/page-header.component';
import { BarChartComponent, BarDatum } from 'src/app/shared/ui/bar-chart.component';
import { Conductor, DashboardService, Integradora, Terminos, Vehiculo } from './dashboard-service.service';
import { CommonModule } from '@angular/common';
import { ServicioLocalStorage } from 'src/app/administrador/servicios/local-storage.service';
import { Rol, Usuario } from 'src/app/core/models/auth.models';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { ModalComponent } from 'src/app/shared/ui/modal.component';
import { RegistroPreventivoComponent } from '../mantenimientos/preventivos/registro-preventivo.component';
import { RegistroCorrectivoComponent } from '../mantenimientos/correctivos/registro-correctivo.component';
import { RetryContext, RetrySubmit } from 'src/app/core/models/retry-context.models';
import { AlistamientosService } from '../alistamientos/alistamientos.service';
import { AlistamientosFormComponent, AlistamientoFormContext, SubmitEvent as AlistamientoSubmitEvent } from '../alistamientos/alistamientos-form.component';
import { finalize } from 'rxjs/operators';
import { catchError, of, switchMap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DetallesActividades, ProtocoloAlistamiento } from '../alistamientos/alistamientos.models';
import { ParametricasService, TipoIdentificacion } from 'src/app/parametricas/servicios/parametricas.service';
import { ProcesosPaginacion } from './dashboard.models';

@Component({
  selector: 'app-dashboard-home',
  template: `
  <div class="container-fluid py-3">
    <app-page-header [title]="'Dashboard'" [subtitle]="'Bienvenido al panel de control.'" />
    <!-- Filtro global por cliente (Solo para administradores) -->
    <div class="filtros" *ngIf="esAdmin">
      <div class="d-flex flex-column">
        <label for="usuarios" class="form-label">Filtrar por cliente:</label>
        <select name="usuarios" id="usuarios" class="form-select" (change)="filtrar($event)" [(ngModel)]="usuarioSeleccionado">
          <option [value]="undefined">Seleccione un cliente</option>
          @for (cliente of clientes; track cliente.nit) {
            <option [value]="cliente.nit">{{ cliente.razon_social }}</option>
          }
        </select>
      </div>
      <div class="d-flex mt-3 border p-3 rounded justify-content-between" *ngIf="resumenDatos && resumenDatos.length && esAdmin">
        <div class="d-flex me-4">
          <label for="razon-social" class="fw-bold me-2"> Razón social: </label>
          <span id="razon-social">
            {{ resumenDatos[0]?.nombreEmpresa || 'N/A' }}
          </span>
        </div>
        <div class="d-flex">
          <label for="nit" class="fw-bold me-2"> NIT: </label>
          <span id="nit">
            {{ resumenDatos[0]?.nitEmpresa || 'N/A' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Sección de gráficos y logs -->
    <div class="card shadow-sm">
      <div class="card-header bg-white border-1 pb-0">
        <ul class="nav nav-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="tab-graficos" data-bs-toggle="tab" data-bs-target="#pane-graficos" type="button" role="tab" aria-controls="pane-graficos" aria-selected="true">
              <i class="bi bi-bar-chart me-1"></i> Gráficos y resúmenes
            </button>
          </li>
          <li class="nav-item" role="presentation" *ngIf="Rol?.id !== 1">
            <button class="nav-link" id="tab-logs" data-bs-toggle="tab" data-bs-target="#pane-logs" type="button" role="tab" aria-controls="pane-logs" aria-selected="false">
              <i class="bi bi-journal-text me-1"></i> Logs de carga masiva
            </button>
          </li>
        </ul>
      </div>
      <div class="card-body tab-content">
        <div id="pane-graficos" class="tab-pane fade show active" role="tabpanel" aria-labelledby="tab-graficos">
          <div class="d-flex flex-wrap mb-3">
            <!-- RESUMEN -->
            <div class="card shadow-sm me-3 mb-3" style="min-width: 250px; flex: 1 1 200px;">
              <div class="card-header">Gráfico de resumen</div>
              <div class="card-body">
                <div class="d-flex flex-wrap gap-3 mb-3">
                  <div class="d-flex flex-column">
                    <label for="fechaInicio" class="form-label">Fecha inicio:</label>
                    <input type="date" id="fechaInicio" class="form-control" [(ngModel)]="fechaInicio" [max]="fechaInicioMax" />
                  </div>
                  <div class="d-flex flex-column">
                    <label for="fechaFin" class="form-label">Fecha fin:</label>
                    <input type="date" id="fechaFin" class="form-control" [(ngModel)]="fechaFin" [min]="fechaFinMin" />
                  </div>
                  <div class="align-self-end">
                    <button class="btn btn-outline-primary mt-2" (click)="aplicarFiltroFechas()" [disabled]="!usuarioSeleccionado && esAdmin">
                      Aplicar
                    </button>
                  </div>
                </div>
                @if (!barData || barData.length === 0) {
                  <p>No se encontraron datos para mostrar.</p>
                }
                <app-bar-chart
                  [data]="barData"
                  [colors]="['#0d6efd', '#6f42c1', '#198754', '#fd7e14', '#20c997', '#dc3545']"
                  [showLegend]="true"
                ></app-bar-chart>
              </div>
            </div>
            <!-- PLACAS CON PÓLIZA -->
            <div class="card shadow-sm mb-3" style="max-width: 700px;">
              <div class="card-header">Placas con póliza</div>
              <div class="card-body">
                <div class="filtros d-flex gap-3 mb-3">
                  <div class="d-flex flex-column">
                    <label for="placa" class="form-label">Buscar por placa:</label>
                    <input type="text" id="placa" class="form-control" placeholder="Ingrese la placa" (input)="getPlacas($event, 1)" />
                  </div>
                  <div class="align-content-end">
                    <p>Total: {{ placas.length }}</p>
                  </div>
                </div>
                <div class="listado-placas">
                  @if (!placas || placas.length === 0) {
                    <p>No se encontraron placas.</p>
                  } @else {
                    <label for="placas" class="fw-bold mb-2">Placas encontradas</label>
                    <div id="placas" class="d-flex" style="flex-wrap: wrap; max-width: 1100px;">
                      @for (placa of placas; track i; let i = $index) {
                        <p class="contenedor-placa">{{ placa }}</p>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
            <!-- CONSULTA INTEGRADORA -->
            <div class="card shadow-sm mb-3">
              <div class="card-header">Consulta integradora</div>
              <div class="card-body">
                <div class="filtros d-flex flex-wrap">
                  <div class="me-3 mb-3">
                    <label for="placa" class="form-label">Placa <span class="text-danger">*</span></label>
                    <input type="text" id="placa" class="form-control" [(ngModel)]="integradoraConsulta.placa" placeholder="Ej: ABC123"/>
                  </div>
                  <div class="me-3 mb-3">
                    <label for="numeroIdentificacion1" class="form-label">Número de Identificación <span class="text-danger">*</span></label>
                    <input type="text" id="numeroIdentificacion1" class="form-control" [(ngModel)]="integradoraConsulta.numeroIdentificacion1"
                    placeholder="Ej: 1067543218"/>
                  </div>
                  <div class="me-3 mb-3">
                    <label for="fechaConsulta" class="form-label">Fecha de Consulta <span class="text-danger">*</span></label>
                    <input type="date" id="fechaConsulta" class="form-control" [(ngModel)]="integradoraConsulta.fechaConsulta" />
                  </div>
                  @if (this.integradoraConsulta.fechaConsulta !== this.hoy.toISOString().split('T')[0]){
                    <div class="me-3 mb-3">
                      <label for="horaConsulta" class="form-label">Hora de Consulta <span class="text-danger">*</span></label>
                      <input type="time" id="horaConsulta" class="form-control" [(ngModel)]="integradoraConsulta.horaConsulta" />
                    </div>
                  }
                  <div class="align-self-end mb-3">
                    <button class="btn btn-brand mt-2" (click)="consultarIntegradora()" [disabled]="cargandoIntegradora">
                      @if (cargandoIntegradora) {
                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Consultando...
                      } @else {
                        Consultar
                      }
                    </button>
                  </div>
                </div>
                <div class="mt-4" *ngIf="integradoraRespuesta">
                  <h5>Datos del Conductor:</h5>
                  @if (integradoraRespuesta.datosConductor) {
                    <!-- <pre>{{ integradoraRespuesta.datosConductor | json }}</pre> -->
                    <div class="table-responsive border rounded">
                      <table class="table table-sm align-middle mb-0">
                        <thead class="table-light">
                          <tr>
                            <th scope="col">Número de Identificación</th>
                            <th scope="col">Nombres</th>
                            <th scope="col">Apellidos</th>
                            <th scope="col">Licencia</th>
                            <th scope="col">Vencimiento</th>
                          </tr>
                        </thead>
                        <tbody>
                          @if (integradoraRespuesta.datosConductor.persona.mensaje) {
                            <tr>
                              <td colspan="5" class="text-center text-muted">No se encontraron datos del conductor.</td>
                            </tr>
                          }
                          <tr>
                            <td>{{ integradoraRespuesta.datosConductor.persona.numeroIdentificacion }}</td>
                            <td>{{ integradoraRespuesta.datosConductor.persona.nombres }}</td>
                            <td>{{ integradoraRespuesta.datosConductor.persona.apellidos }}</td>
                            <td>{{ integradoraRespuesta.datosConductor.licencia.numeroLicencia }}</td>
                            <td>{{ integradoraRespuesta.datosConductor.licencia.fechaVencimiento }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p>No se encontraron datos del conductor.</p>
                  }
                  <h5 class="mt-4">Datos del Vehículo:</h5>
                  @if (integradoraRespuesta.datosVehiculo) {
                    <!-- <pre>{{ integradoraRespuesta.datosVehiculo | json }}</pre> -->
                    <div class="table-responsive border rounded">
                      <table class="table table-sm align-middle mb-0">
                        <thead class="table-light">
                          <tr>
                            <th scope="col">Placa</th>
                            <th scope="col">Clase de vehículo</th>
                            <th scope="col">Soat</th>
                            <th scope="col">Vencimiento SOAT</th>
                            <th scope="col">Tecnomecánica</th>
                            <th scope="col">Vencimiento Tecnomecánica</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{{ integradoraRespuesta.datosVehiculo.placa }}</td>
                            <td>{{ integradoraRespuesta.datosVehiculo.claseVehiculo }}</td>
                            <td>{{ integradoraRespuesta.datosVehiculo.numeroSoat }}</td>
                            <td>{{ integradoraRespuesta.datosVehiculo.soatVencimiento }}</td>
                            <td>{{ integradoraRespuesta.datosVehiculo.numeroRtm }}</td>
                            <td>{{ integradoraRespuesta.datosVehiculo.rtmVencimiento }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p>No se encontraron datos del vehículo.</p>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- LOGS -->
        <div id="pane-logs" class="tab-pane fade" role="tabpanel" aria-labelledby="tab-logs">
          <div class="d-flex flex-column mb-3">
            <!-- ESTADO DE CARGUE MASIVO (En tiempo real) -->
            <div class="card shadow-sm mb-3">
              <div class="card-header">Estados de cargues masivos</div>
              <div class="card-body">
                <div class="d-flex flex-wrap gap-3 mb-3">
                  <input type="text" class="form-control me-2" style="max-width: 200px;" placeholder="Filtrar por placa" (input)="filtrarProcesos()"
                  [(ngModel)]="terminos.placa"/>
                  <input type="date" class="form-control me-2" style="max-width: 200px;" placeholder="Filtrar por fecha" (input)="filtrarProcesos()"
                  [(ngModel)]="terminos.fecha"/>
                  <select class="form-select me-2" style="max-width: 200px;" (change)="filtrarProcesos()"
                  [(ngModel)]="terminos.estado">
                    <option value="undefined">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="procesado">Procesado</option>
                    <option value="fallido">Fallido</option>
                  </select>
                  <select class="form-select me-2" style="max-width: 200px;" (change)="filtrarProcesos()"
                  [(ngModel)]="terminos.tipo">
                    <option value="undefined">Todos los tipos</option>
                    <option value="preventivo">Preventivo</option>
                    <option value="correctivo">Correctivo</option>
                    <option value="alistamiento">Alistamiento</option>
                  </select>

                  <button class="btn btn-outline-primary" (click)="limpiarFiltrosProcesos()">Limpiar filtros</button>
                </div>
                <div class="table-responsive border rounded">
                  <table class="table table-sm align-middle mb-0">
                    <thead class="table-light">
                      <tr>
                        <th scope="col">Placa</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Fecha de diligenciamiento</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Reintentos</th>
                        <!-- <th scope="col">Proximo reintento</th> -->
                        <th scope="col">Descripción</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      @if (procesos().length === 0) {
                        <tr>
                          <td colspan="7" class="text-center text-muted">Sin registros para mostrar.</td>
                        </tr>
                      } @else {
                        @for (proc of procesos(); track i; let i = $index) {
                          <tr>
                            <td>{{proc.mantenimiento?.placa ?? proc.detalle?.placa ?? proc.payload?.placa ?? '-' }}</td>
                            <td>{{ tipoLogLabel(proc.payload?.tipoId ?? proc.datosCompletos?.tipoId ?? null) }}</td>
                            <td>{{ proc.mantenimiento?.fecha_diligenciamiento | date:'dd/MM/yyyy HH:mm':'UTC' }}</td>
                            <td>
                              <span [class]="estadoBadge(proc.estado ?? proc.datosCompletos?.estado ?? '')">
                                {{ capitalizeFirst(proc.estado ?? proc.datosCompletos?.estado ?? '') }}
                              </span>
                            </td>
                            <td>{{ proc.reintentos ?? 0 }}</td>
                            <!-- <td>{{ proc.siguienteIntento ? (proc.siguienteIntento | date:'short') : '-' }}</td> -->
                            <td>{{ proc.trabajosAsociados[0].ultimoError}}</td>
                            <td class="d-flex gap-2">
                              <button class="btn btn-sm btn-outline-primary" (click)="reintentoAutomatico(proc)" title='Reintento automático' [disabled]="proc.estado !== 'fallido'">
                                <i class="bi bi-arrow-clockwise"></i>
                              </button>
                              <button class="btn btn-sm btn-outline-secondary" (click)="reintentoManual(proc)" title='Reintento manual' [disabled]="proc.estado !== 'fallido'">
                                <i class="bi bi-hand-index-thumb"></i>
                              </button>
                            </td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>
                <div class="pagination d-flex justify-content-end mt-2">
                  <nav aria-label="Procesos pagination">
                    <ul class="pagination pagination-sm mb-0">
                      <li class="page-item" [class.disabled]="procesosCurrentPage() === 1">
                        <button class="page-link" (click)="goToProcesosPage(procesosCurrentPage() - 1)" aria-label="Anterior">«</button>
                      </li>
                      <li class="page-item" [class.disabled]="procesosCurrentPage() === 1">
                        <button class="page-link" (click)="goToProcesosPage(1)" aria-label="Primera">1</button>
                      </li>
                      @if (showLeftEllipsisProcesos()) {
                        <li class="page-item disabled"><span class="page-link">…</span></li>
                      }
                      @for (p of procesosMiddlePages(); track p) {
                        <li class="page-item" [class.active]="p === procesosCurrentPage()">
                          <button class="page-link" (click)="goToProcesosPage(p)">{{ p }}</button>
                        </li>
                      }
                      @if (showRightEllipsisProcesos()) {
                        <li class="page-item disabled"><span class="page-link">…</span></li>
                      }
                      @if (procesosTotalPages() > 1) {
                        <li class="page-item" [class.disabled]="procesosCurrentPage() === procesosTotalPages()">
                          <button class="page-link" (click)="goToProcesosPage(procesosTotalPages())" aria-label="Última">{{ procesosTotalPages() }}</button>
                        </li>
                      }
                      <li class="page-item" [class.disabled]="procesosCurrentPage() === procesosTotalPages()">
                        <button class="page-link" (click)="goToProcesosPage(procesosCurrentPage() + 1)" aria-label="Siguiente">»</button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <app-modal [open]="retryModalOpen()" [title]="retryModalTitle()" size="xl" (closed)="closeRetryModal()">
      @if (retryTipoId() === 1 && retryContext()) {
        <app-registro-preventivo
          [inModal]="true"
          [initialPlaca]="retryPlaca()"
          [modalOpen]="retryModalOpen()"
          [resetToken]="retryReset()"
          [retryMode]="true"
          [retryData]="retryContext()"
          (retry)="onPreventivoRetry($event)"
          (closed)="closeRetryModal()"
        />
      } @else if (retryTipoId() === 2 && retryContext()) {
        <app-registro-correctivo
          [inModal]="true"
          [initialPlaca]="retryPlaca()"
          [modalOpen]="retryModalOpen()"
          [resetToken]="retryReset()"
          [retryMode]="true"
          [retryData]="retryContext()"
          (retry)="onCorrectivoRetry($event)"
          (closed)="closeRetryModal()"
        />
      } @else if (retryTipoId() === 3 && alistamientoRetryContext()) {
        <app-alistamientos-form
          [context]="alistamientoRetryContext()!"
          [actividades]="actividadesRetry()"
          [tiposIdentificacion]="tiposIdRetry()"
          [saving]="retrySubmitting()"
          (submit)="onAlistamientoRetry($event)"
          (cancel)="closeRetryModal()"
        />
      } @else {
        <div class="py-4 text-center text-muted">Selecciona un registro para continuar.</div>
      }
    </app-modal>
  </div>
  `,
  styles: [`
    :host { display: block; }
    .card { width: 100%; border-radius: 0.5rem; padding: 0;}
    .card-header { font-weight: bold; font-size: 1.25rem; background-color: #f8f9fa; }
    .card-body { padding: 1rem; }
    .filtros { margin-bottom: 1rem; border-bottom: 1px solid #dee2e6; padding-bottom: 1rem; }
    .listado-placas { margin-top: 1rem; }
    .contenedor-placa {
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 0.25rem;
      padding: 0.5rem 1rem;
      margin-right: 0.5rem;
    }
    .badge { font-size: 0.75rem; }
  `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, CommonModule, BarChartComponent, FormsModule, ModalComponent, RegistroPreventivoComponent, RegistroCorrectivoComponent, AlistamientosFormComponent],
})
export class DashboardHomeComponent implements OnInit {
  private readonly storage = inject(ServicioLocalStorage);
  private readonly dashboardService = inject(DashboardService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly parametricas = inject(ParametricasService);
  private readonly alistamientosService = inject(AlistamientosService);
  private readonly destroyRef = inject(DestroyRef);
  esAdmin: boolean = false;
  integradoraConsulta: Integradora = {};
  integradoraRespuesta: {datosConductor: Conductor | null, datosVehiculo: Vehiculo | null} | null = null;
  cargandoIntegradora = false;
  resumenDatos?: any[];
  barData: BarDatum[] = [];
  hoy = new Date();
  fechaInicio?: string;
  fechaFin?: string;
  placas: any[] = [];
  procesos = signal<Array<any>>([]);
  procesosPaginacion = signal<ProcesosPaginacion>({ totalRegistros: 0, paginaActual: 1, totalPaginas: 1 });
  retryModalOpen = signal(false);
  retryContext = signal<RetryContext | null>(null);
  retryReset = signal(0);
  retrySubmitting = signal(false);
  alistamientoRetryContext = signal<AlistamientoFormContext | null>(null);
  tiposIdRetry = signal<TipoIdentificacion[]>([]);
  actividadesRetry = signal<DetallesActividades[]>([]);

  readonly procesosPageSize = 10;
  readonly procesosCurrentPage = computed(() => this.procesosPaginacion().paginaActual ?? 1);
  readonly procesosTotalPages = computed(() => Math.max(1, Math.ceil((this.procesosPaginacion().totalPaginas ?? 1))));
  readonly procesosMiddlePages = computed(() => {
    const tp = this.procesosTotalPages();
    const cp = this.procesosCurrentPage();
    const pages: number[] = [];
    if (tp <= 5) {
      for (let p = 1; p <= tp; p++) if (p !== 1 && p !== tp) pages.push(p);
      return pages;
    }
    const start = Math.max(2, cp - 1);
    const end = Math.min(tp - 1, cp + 1);
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  });
  readonly showLeftEllipsisProcesos = computed(() => this.procesosTotalPages() > 5 && (this.procesosCurrentPage() > 3));
  readonly showRightEllipsisProcesos = computed(() => this.procesosTotalPages() > 5 && (this.procesosCurrentPage() < this.procesosTotalPages() - 2));
  readonly retryTipoId = computed(() => {
    const raw = this.retryContext()?.tipoId;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  });
  readonly retryPlaca = computed(() => this.resolvePlaca(this.retryContext()));
  readonly retryModalTitle = computed(() => {
    const tipo = this.retryTipoId();
    const placa = this.retryPlaca();
    const label = this.retryTipoLabel(tipo);
    return placa ? `Reintentar ${label} — Placa: ${placa}` : `Reintentar ${label}`;
  });
  clientes: {nit: string, razon_social: string}[] = [];
  userInfo: Usuario | null = this.storage.obtenerUsuario();
  Rol: Rol | null = this.storage.obtenerRol();
  terminos: Terminos = {};
  usuarioSeleccionado?: string;
  private procesosPollingStarted = false;

  get fechaFinMin(): string {
    //console.log('Calculando fechaFinMin con fechaInicio:', this.fechaInicio);
    //console.log('Resultado de fechaFinMin:', this.fechaInicio ? this.addDaysString(this.fechaInicio, 1) : '');
    return this.fechaInicio ? this.addDaysString(this.fechaInicio, 1) : '';
    }

  get fechaInicioMax(): string {
    return this.fechaFin ? this.addDaysString(this.fechaFin, -1) : '';
  }

  constructor() {
    this.esAdmin = this.Rol?.id === 1;
    if (this.esAdmin) {
      this.getClientes();
    }
  }

  ngOnInit() {
    this.integradoraConsulta.fechaConsulta = this.hoy.toISOString().split('T')[0];
    //console.log('Fecha de consulta inicial:', this.integradoraConsulta.fechaConsulta === this.hoy.toISOString().split('T')[0]);
    // Inicializar filtros de fecha en el rango del mes actual
    const dt = new Date(this.hoy);
    const first = new Date(dt.getFullYear(), dt.getMonth(), 1);
    const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
    this.fechaInicio = first.toISOString().split('T')[0];
    this.fechaFin = last.toISOString().split('T')[0];
    if (!this.esAdmin) {
      this.getResumenDatos();
      this.getPlacas();
      this.startProcesosPolling();
    }
  }

  // Capitaliza la primera letra de un string
  capitalizeFirst(value: unknown): string {
    if (typeof value !== 'string') return '';
    const v = value.trim();
    if (!v) return '';
    return v.charAt(0).toUpperCase() + v.slice(1);
  }

  tipoLogLabel(tipoId: number | null): string {
    switch (tipoId) {
      case 1: return 'Preventivo';
      case 2: return 'Correctivo';
      case 3: return 'Alistamiento';
      default: return 'Desconocido';
    }
  }

  estadoBadge(estado: unknown): string {
    const v = typeof estado === 'string' ? estado.toLowerCase() : '';
    if (v === 'pendiente' || v === 'en cola') return 'badge bg-warning-subtle text-warning-emphasis';
    if (v === 'procesado' || v === 'procesando') return 'badge bg-success-subtle text-success-emphasis';
    if (v === 'fallido' || v === 'error') return 'badge bg-danger-subtle text-danger-emphasis';
    return 'badge bg-secondary-subtle text-secondary-emphasis';
  }

  filtrar(event: Event) {
    this.integradoraConsulta.nit = undefined;
    let nit: string | undefined;
    this.resumenDatos = undefined;
    this.barData = [];
    this.placas = [];
    if (event) {
      const selectElement = event.target as HTMLSelectElement;
      nit = selectElement.value || undefined;
      if (nit !== '' && nit !== undefined && nit !== null && nit !== 'undefined') {
        if (this.esAdmin) {
          this.integradoraConsulta.nit = nit || undefined;
        }
        this.getPlacas(event, 2);
        this.getResumenDatos(event);
        this.getProcesos(event);
      } else {
        this.usuarioSeleccionado = undefined;
      }
    }
  }

  getClientes() {
    this.clientes = [];
    this.dashboardService.getClientes().subscribe((data: any) => {
      this.clientes = data.array_data.usuarios;
      //console.log('Datos de clientes:', this.clientes);
      this.cdr.markForCheck();
    });
  }

  getResumenDatos(event?: Event) {
    let nit: string | undefined;
    let fechaInicio = this.fechaInicio ?? '';
    let fechaFin = this.fechaFin ?? '';
    if (this.esAdmin) {
      if (event) {
        const selectElement = event.target as HTMLSelectElement;
        nit = selectElement.value || undefined;
      } else {nit = this.usuarioSeleccionado || undefined; }
    } else { nit = this.userInfo?.usuario; }
    // Consultar resumen (si el servicio no soporta fechas, luego filtramos en cliente)
    this.dashboardService.getResumenDatos(nit, fechaInicio, fechaFin).subscribe(data => {
      //console.log('Datos del dashboard:', data);
      this.resumenDatos = data;
      this.barData = this.mapResumenToBars(data);
      this.cdr.markForCheck();
    });
  }

  getPlacas(event?: Event, filterType?: number) {
    let placa: string | undefined;
    let nit: string | undefined;
    if (event && filterType) {
      const targetElement = event.target as HTMLInputElement | HTMLSelectElement;
      if (filterType === 1) {
        placa = (targetElement as HTMLInputElement).value || undefined;
        nit = this.usuarioSeleccionado || undefined;
      } else if (filterType === 2) {
        nit = (targetElement as HTMLSelectElement).value || undefined;
      }
    } else { nit = this.userInfo?.usuario; }
    this.dashboardService.getPlacas(placa, nit).subscribe(data => {
      this.placas = data;
      //console.log('Datos de placas:', this.placas);
      this.cdr.markForCheck();
    });
  }

  goToProcesosPage(p: number) {
    const tp = this.procesosTotalPages();
    if (p < 1 || p > tp) return;
    this.procesosPaginacion.update(state => ({
      ...state,
      paginaActual: p,
    }));
    this.fetchProcesosPage();
  }

  getProcesos(event?: Event) {
    if (!this.procesosPollingStarted) {
      this.startProcesosPolling();
    } else {
      this.fetchProcesosPage(event);
    }
  }

  private startProcesosPolling() {
    if (this.procesosPollingStarted) return;
    this.procesosPollingStarted = true;
    timer(0, 8000)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => {
          const pagina = this.procesosCurrentPage();
          const nit = this.esAdmin ? this.integradoraConsulta.nit ?? undefined : this.userInfo?.usuario;
          return this.dashboardService.listarProcesos(pagina, this.procesosPageSize, nit, this.terminos).pipe(
            catchError(error => {
              console.error('Error al obtener procesos en cola (polling):', error);
              return of(null);
            })
          );
        })
      )
      .subscribe(data => this.updateProcesosState(data));
  }

  private fetchProcesosPage(event?: Event, paginaInicial?: number) {
    const pagina = paginaInicial ?? this.procesosCurrentPage();
    let nit: string | undefined;
    if (event && this.esAdmin) {
      const selectElement = event.target as HTMLSelectElement;
      nit = selectElement.value || undefined;
    } else {
      nit = this.esAdmin ? this.integradoraConsulta.nit ?? undefined : this.userInfo?.usuario;
    }
    this.dashboardService.listarProcesos(pagina, this.procesosPageSize, nit, this.terminos)
      .pipe(catchError(error => {
        console.error('Error al obtener procesos en cola:', error);
        return of(null);
      }))
      .subscribe(data => this.updateProcesosState(data));
  }

  private updateProcesosState(data: any) {
    if (!data) return;
    const pagina = this.procesosCurrentPage();
    const arrayDatos = Array.isArray(data?.datos) ? data.datos : [];
    this.procesos.set(arrayDatos);
    this.procesosPaginacion.set({
      totalRegistros: Number(data?.paginacion?.totalRegistros ?? arrayDatos.length ?? 0),
      paginaActual: Number(data?.paginacion?.paginaActual ?? pagina ?? 1),
      totalPaginas: Number(data?.paginacion?.totalPaginas ?? 1),
    });
    this.cdr.markForCheck();
  }

  filtrarProcesos() {
    this.fetchProcesosPage(undefined, 1);
  }
  limpiarFiltrosProcesos() {
    this.terminos = {};
    this.fetchProcesosPage(undefined, 1);
  }

  private addDaysString(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  reintentoAutomatico(log: any) {
    const body = {accion: "actualizar"}
    this.dashboardService.reintento(log.id, body).subscribe({
      next: (response) => {
        Swal.fire({
          icon: 'success',
          title: 'Reintento automático iniciado',
          html: '<p>' +  response.mensaje + '</p>',
        });
        this.fetchProcesosPage(undefined, this.procesosCurrentPage());
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'No fue posible iniciar el reintento automático' });
      },
    });
  }

  reintentoManual(log: any) {
    const ctx = this.mapLogToRetryContext(log);
    this.retryContext.set(ctx);
    this.retryReset.update((v) => v + 1);
    if (this.retryTipoId() === 3) {
      this.prepareAlistamientoRetry(ctx);
    } else {
      this.alistamientoRetryContext.set(null);
    }
    this.retryModalOpen.set(true);
  }

  consultarIntegradora() {
    if (!this.integradoraConsulta.placa && !this.integradoraConsulta.numeroIdentificacion1) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta información',
        text: 'Por favor ingrese la placa y el número de identificación para realizar la consulta.',
      });
      return;
    } else if (this.integradoraConsulta.fechaConsulta !== this.hoy.toISOString().split('T')[0]) {
      if (!this.integradoraConsulta.horaConsulta) {
        Swal.fire({
          icon: 'warning',
          title: 'Falta información',
          text: 'Por favor ingrese la hora de consulta para la fecha seleccionada.',
        });
        return;
      }
    }
    if (!this.esAdmin) {this.integradoraConsulta.nit = this.userInfo?.usuario;}
    this.cargandoIntegradora = true;
    this.dashboardService.consultarIntegradora(this.integradoraConsulta).subscribe((data:any) => {
      //console.log('Respuesta de consulta integradora:', data);
      this.cargandoIntegradora = false;
      // Ensure integradoraRespuesta is initialized before assigning to its properties
      this.integradoraRespuesta = {
        datosConductor: data?.obj?.conductor1 ?? null,
        datosVehiculo: data?.obj?.vehiculo ?? null
      };
      this.cdr.markForCheck();
    }, error => {
      console.error('Error al consultar la integradora:', error);
      this.cargandoIntegradora = false;
      Swal.fire({
        icon: 'error',
        title: error?.error?.titulo ?? 'Error en la consulta',
        text: error?.error?.mensajes ?? 'No fue posible completar la consulta. Por favor intente nuevamente más tarde.',
      });
      this.cdr.markForCheck();
    });
  }

  aplicarFiltroFechas() {
    if (this.fechaInicio && this.fechaFin && this.fechaInicio >= this.fechaFin) {
      Swal.fire({ icon: 'warning', title: 'Rango inválido', text: 'La fecha inicio no puede ser mayor o igual que la fecha fin.' });
      return;
    }
    this.getResumenDatos();
  }

  onPreventivoRetry(event: RetrySubmit<any>) {
    this.retrySubmitting.set(true);
    console.log('Evento de reintento preventivo:', event.payload);
    const payload = this.toManualPreventivoPayload(event.payload, 1);
    console.log('Payload de reintento preventivo:', payload);
    this.dashboardService
      .reintentarPreventivo(event.context, payload)
      .pipe(finalize(() => this.retrySubmitting.set(false)))
      .subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Reintento enviado', timer: 1400, showConfirmButton: false });
          this.closeRetryModal(true);
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'No fue posible reintentar' });
        },
      });
  }

  onCorrectivoRetry(event: RetrySubmit<any>) {
    this.retrySubmitting.set(true);
    const payload = this.toManualPreventivoPayload(event.payload, 2); // misma estructura
    this.dashboardService
      .reintentarCorrectivo(event.context, payload)
      .pipe(finalize(() => this.retrySubmitting.set(false)))
      .subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Reintento enviado', timer: 1400, showConfirmButton: false });
          this.closeRetryModal(true);
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'No fue posible reintentar' });
        },
      });
  }

  onAlistamientoRetry(event: AlistamientoSubmitEvent) {
    if (this.retrySubmitting()) return; // evitar doble envío
    const ctx = this.retryContext();
    if (!ctx) return;
    const payload = this.toManualAlistamientoPayload(event.protocolo);
    this.retrySubmitting.set(true);
    this.dashboardService
      .reintentarAlistamiento(ctx, payload)
      .pipe(finalize(() => this.retrySubmitting.set(false)))
      .subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Reintento enviado', timer: 1400, showConfirmButton: false });
          this.closeRetryModal(true);
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'No fue posible reintentar' });
        },
      });
  }

  closeRetryModal(refresh = false) {
    this.retryModalOpen.set(false);
    this.retrySubmitting.set(false);
    this.retryContext.set(null);
    this.alistamientoRetryContext.set(null);
    if (refresh) {
      this.fetchProcesosPage(undefined, this.procesosCurrentPage());
    }
  }

  private mapLogToRetryContext(log: any): RetryContext {
    if (!log) return { tipoId: null };
    const payload = log.payload ?? {};
    const detalle = log.detalle ?? {};
    const datosCompletos = log.datosCompletos ?? {};
    const mantenimiento = log.mantenimiento ?? {};
    return {
      jobId: log.id ?? null,
      tipoId: Number(payload.tipoId ?? datosCompletos.tipoId ?? log.tipoId ?? null),
      tipo: log.tipo ?? datosCompletos.tipo ?? null,
      mantenimientoLocalId: log.mantenimientoLocalId ?? datosCompletos.mantenimientoLocalId ?? mantenimiento.id ?? null,
      detalleId: log.detalleId ?? datosCompletos.detalleId ?? null,
      mantenimientoId: mantenimiento.mantenimiento_id ?? mantenimiento.mantenimientoId ?? mantenimiento.id ?? null,
      vigiladoId: log.vigiladoId ?? payload.vigiladoId ?? datosCompletos.vigiladoId ?? null,
      usuarioDocumento: log.usuarioDocumento ?? null,
      payload,
      detalle,
      datosCompletos,
    };
  }

  private resolvePlaca(ctx: RetryContext | null): string {
    if (!ctx) return '';
    const detalle: any = ctx.detalle ?? {};
    const payload: any = ctx.payload ?? {};
    return (detalle.placa ?? payload.placa ?? '') as string;
  }

  private retryTipoLabel(tipo: number | null): string {
    if (tipo === 1) return 'mantenimiento preventivo';
    if (tipo === 2) return 'mantenimiento correctivo';
    if (tipo === 3) return 'alistamiento';
    return 'mantenimiento';
  }

  private toManualPreventivoPayload(src: any, tipo: number) {
    const safe = src ?? {};
    const vigiladoId = this.retryContext()?.vigiladoId ?? safe.vigiladoId ?? safe.nit ?? '';
    const detalle = {
      placa: safe.placa ?? '',
      fecha: safe.fecha ?? '',
      hora: safe.hora ?? '',
      nit: safe.nit ?? vigiladoId ?? '',
      razonSocial: safe.razonSocial ?? '',
      tipoIdentificacion: safe.tipoIdentificacion ?? safe.tipoId ?? '',
      numeroIdentificacion: safe.numeroIdentificacion ?? '',
      nombreIngeniero: safe.nombreIngeniero ?? safe.nombresResponsable ?? '',
      detalleActividades: safe.detalleActividades ?? safe.detalle_actividades ?? '',
    };
    return {
      cabecera: {
        placa: detalle.placa,
        tipoId: tipo,
        vigiladoId,
      },
      detalle,
    };
  }

  private toManualAlistamientoPayload(src: ProtocoloAlistamiento) {
    const s = src || ({} as ProtocoloAlistamiento);
    const ctx = this.retryContext();
    const vigiladoId = ctx?.vigiladoId ?? (s as any).nitTransporte ?? '';
    const detalle: any = {
      placa: s.placa ?? '',
      tipoIdentificacion: s.tipoIdentificacion ?? '',
      numeroIdentificacion: s.numeroIdentificacion ?? null,
      nombreResponsable: s.nombreResponsable ?? '',
      tipoIdentificacionConductor: s.tipoIdentificacionConductor ?? '',
      numeroIdentificacionConductor: s.numeroIdentificacionConductor ?? null,
      nombreConductor: s.nombreConductor ?? '',
      actividades: s.actividades ?? [],
      detalleActividades: s.detalleActividades ?? '',
    };
    if ((s as any).nitTransporte) {
      detalle.nitTransporte = (s as any).nitTransporte;
    }
    return {
      cabecera: {
        placa: detalle.placa,
        tipoId: 3,
        vigiladoId,
      },
      detalle,
    };
  }

  private prepareAlistamientoRetry(ctx: RetryContext) {
    this.ensureTiposId();
    this.ensureActividades();
    const detalle: any = ctx.detalle ?? {};
    const payload: any = ctx.payload ?? {};
    const initial: ProtocoloAlistamiento = {
      placa: this.resolvePlaca(ctx),
      tipoIdentificacion: payload.tipoIdentificacionResponsable ?? '',
      numeroIdentificacion: payload.numeroIdentificacionResponsable ?? '',
      nombreResponsable: payload.nombresResponsable ?? payload.nombreResponsable ?? '',
      tipoIdentificacionConductor: payload.tipoIdentificacionConductor ?? '',
      numeroIdentificacionConductor: payload.numeroIdentificacionConductor ?? '',
      nombreConductor: payload.nombresConductor ?? payload.nombreConductor ?? '',
      actividades: payload.actividades ?? [],
      detalleActividades: payload.detalleActividades ?? '',
    };

    this.alistamientoRetryContext.set({
      placa: this.resolvePlaca(ctx),
      modo: 'retry',
      mantenimientoId: ctx.mantenimientoId ?? ctx.mantenimientoLocalId ?? undefined,
      vigiladoId: (ctx.vigiladoId as string) ?? '',
      initial,
    });
  }

  private ensureTiposId() {
    if (this.tiposIdRetry().length) return;
    this.parametricas.obtenerTipoIdentificaciones().subscribe({
      next: (lista) => {
        const arr = Array.isArray(lista) ? lista : [];
        this.tiposIdRetry.set(arr);
      },
      error: () => {
        this.tiposIdRetry.set([]);
      },
    });
  }

  private ensureActividades() {
    if (this.actividadesRetry().length) return;
    this.alistamientosService.listarActividades().subscribe({
      next: (lista) => {
        const arr = Array.isArray(lista) ? lista : [];
        this.actividadesRetry.set(arr);
      },
      error: () => {
        this.actividadesRetry.set([]);
      },
    });
  }

  private mapResumenToBars(data: any): BarDatum[] {
    if (!Array.isArray(data)) return [];
    // Filtrar por rango si el backend no lo aplica
    const fi = this.fechaInicio ? new Date(this.fechaInicio) : null;
    const ff = this.fechaFin ? new Date(this.fechaFin) : null;
    const parseApiDate = (s: string) => {
      const [dd, mm, yyyy] = (s || '').split('/').map(Number);
      return new Date(yyyy, (mm ?? 1) - 1, dd ?? 1);
    };
    const inRange = (d: Date) => (!fi || d >= fi) && (!ff || d <= ff!);

    // Agrupar por fecha y desglosar por categoría
    const byFecha = new Map<string, { [k: string]: number }>();
    for (const item of data) {
      const fecha: string = item?.fecha;
      if (!fecha) continue;
      const d = parseApiDate(fecha);
      if (!inRange(d)) continue;
      const acc = byFecha.get(fecha) ?? { ['mantenimientoCorrectivo']: 0, ['mantenimientoPreventivo']: 0, ['alistamiento']: 0, ['autorizaciones']: 0, ['despachos']: 0, ['novedades']: 0 };
      acc['mantenimientoCorrectivo'] += Number(item?.mantenimientoCorrectivo ?? 0);
      acc['mantenimientoPreventivo'] += Number(item?.mantenimientoPreventivo ?? 0);
      acc['alistamiento'] += Number(item?.alistamiento ?? 0);
      acc['autorizaciones'] += Number(item?.autorizaciones ?? 0);
      acc['despachos'] += Number(item?.despachos ?? 0);
      acc['novedades'] += Number(item?.novedades ?? 0);
      byFecha.set(fecha, acc);
    }

    // Ordenar fechas descendente por valor de fecha real
    const sortedFechas = Array.from(byFecha.keys()).sort((a, b) => {
      return parseApiDate(b).getTime() - parseApiDate(a).getTime();
    });

    // Convertir a BarDatum con segmentos por categoría
    const toLabel = (k: string) => {
      const map: Record<string, string> = {
        mantenimientoCorrectivo: 'Correctivo',
        mantenimientoPreventivo: 'Preventivo',
        alistamiento: 'Alistamiento',
        autorizaciones: 'Autorizaciones',
        despachos: 'Despachos',
        novedades: 'Novedades',
      };
      return map[k] ?? k;
    };

    const result: BarDatum[] = sortedFechas.map(fecha => {
      const obj = byFecha.get(fecha)!;
      const segments = Object.entries(obj).map(([key, value]) => ({ key: toLabel(key), value: Number(value) || 0 }));
      return { label: fecha, segments };
    });
    return result;
  }
}
